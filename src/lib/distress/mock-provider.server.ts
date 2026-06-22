// Deterministic mock data provider. Returns realistic distressed-property
// records based on the requested filters so the entire app — search, save,
// scoring, lead-list flow — works end-to-end before any paid API is wired.
//
// Replace this with a real adapter (ATTOM, BatchData, etc.) without changing
// the consumer code.

import type {
  DistressSearchFilters,
  DistressType,
  DistressedPropertyRecord,
  PropertyProvider,
} from "./provider";
import { COUNTIES_BY_STATE } from "./counties";

const STREETS = [
  "Maple Ave", "Oak St", "Pine Rd", "Cedar Ln", "Elm Dr", "Birch Way",
  "Willow Ct", "Sycamore Blvd", "Magnolia Pl", "Cypress Trail",
  "Juniper Cir", "Walnut St", "Chestnut Ave", "Spruce Rd", "Hickory Ln",
];

const CITIES_BY_STATE: Record<string, string[]> = {
  // Featured Northeast markets
  NY: ["New York", "Brooklyn", "Queens", "Bronx", "Buffalo", "Rochester", "Yonkers", "Syracuse", "Albany"],
  NJ: ["Newark", "Jersey City", "Paterson", "Elizabeth", "Trenton", "Camden", "Atlantic City", "Edison"],
  CT: ["Bridgeport", "New Haven", "Hartford", "Stamford", "Waterbury", "Norwalk", "Danbury"],
  PA: ["Philadelphia", "Pittsburgh", "Allentown", "Erie", "Reading", "Scranton", "Bethlehem"],
  // Other states
  TX: ["Houston", "Dallas", "Austin", "San Antonio", "Fort Worth"],
  FL: ["Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale"],
  CA: ["Los Angeles", "San Diego", "Sacramento", "Fresno", "Bakersfield"],
  GA: ["Atlanta", "Augusta", "Savannah", "Macon", "Columbus"],
  AZ: ["Phoenix", "Tucson", "Mesa", "Chandler", "Scottsdale"],
  NV: ["Las Vegas", "Reno", "Henderson", "North Las Vegas"],
  OH: ["Cleveland", "Columbus", "Cincinnati", "Toledo", "Akron"],
  NC: ["Charlotte", "Raleigh", "Greensboro", "Durham"],
  MA: ["Boston", "Worcester", "Springfield", "Lowell", "Cambridge"],
  MD: ["Baltimore", "Silver Spring", "Frederick", "Rockville"],
  VA: ["Virginia Beach", "Norfolk", "Richmond", "Arlington", "Alexandria"],
  IL: ["Chicago", "Aurora", "Rockford", "Joliet", "Naperville"],
  MI: ["Detroit", "Grand Rapids", "Warren", "Flint", "Lansing"],
};

const ALL_TYPES: DistressType[] = [
  "reo", "preforeclosure", "auction", "tax_lien",
  "tax_delinquent", "fsbo_stale", "vacant", "absentee",
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function listingStatusFor(t: DistressType) {
  switch (t) {
    case "reo": return "active" as const;
    case "preforeclosure": return "active" as const;
    case "auction": return "auction_scheduled" as const;
    case "fsbo_stale": return "active" as const;
    case "tax_lien":
    case "tax_delinquent": return "off_market" as const;
    default: return "off_market" as const;
  }
}

function buildRecord(
  state: string,
  city: string,
  zip: string,
  county: string,
  idx: number,
  distressType: DistressType,
): DistressedPropertyRecord {
  const seed = hash(`${state}-${county}-${city}-${zip}-${idx}-${distressType}`);
  const streetNum = 100 + (seed % 9800);
  const street = pick(STREETS, seed >> 3);
  const address = `${streetNum} ${street}`;
  const estimatedValue = 120_000 + (seed % 580_000);
  const equityPct = 0.1 + ((seed >> 7) % 90) / 100;
  const equity = Math.round(estimatedValue * equityPct);
  const listPrice = distressType === "tax_lien" || distressType === "tax_delinquent"
    ? null
    : Math.round(estimatedValue * (0.85 + ((seed >> 5) % 30) / 100));
  const dom = distressType === "fsbo_stale"
    ? 60 + (seed % 240)
    : distressType === "reo"
    ? 30 + (seed % 200)
    : (seed % 90);

  const listDate = new Date(Date.now() - dom * 86_400_000).toISOString().slice(0, 10);
  const auctionDate = distressType === "auction"
    ? new Date(Date.now() + (7 + (seed % 60)) * 86_400_000).toISOString().slice(0, 10)
    : null;
  const taxOwed = distressType === "tax_lien" || distressType === "tax_delinquent"
    ? 1_500 + (seed % 25_000)
    : null;
  const lienAmount = distressType === "tax_lien" ? taxOwed : null;

  return {
    sourceRecordId: `mock-${state}-${zip}-${idx}-${distressType}`,
    address,
    city,
    state,
    zip,
    county,
    propertyType: pick(["single_family", "duplex", "townhouse", "condo"], seed >> 11),
    beds: 2 + (seed % 4),
    baths: 1 + (seed % 3),
    sqft: 900 + (seed % 2800),
    yearBuilt: 1950 + (seed % 73),
    estimatedValue,
    equity,
    listPrice,
    listDate,
    daysOnMarket: dom,
    auctionDate,
    taxOwed,
    lienAmount,
    distressType,
    listingStatus: listingStatusFor(distressType),
    ownerName: `${pick(["James","Maria","Robert","Linda","Michael","Patricia","David","Jennifer"], seed)} ${pick(["Smith","Garcia","Johnson","Lee","Brown","Davis","Miller","Wilson"], seed >> 9)}`,
    isAbsentee: distressType === "absentee" || (seed % 5 === 0),
    isVacant: distressType === "vacant" || (seed % 7 === 0),
  };
}

export class MockProvider implements PropertyProvider {
  readonly name = "mock";

  async searchDistressed(filters: DistressSearchFilters): Promise<DistressedPropertyRecord[]> {
    const state = (filters.state || "NY").toUpperCase();
    const counties = COUNTIES_BY_STATE[state] ?? [];
    const countyMatch = filters.county
      ? counties.find((c) => c.name.toLowerCase().includes(filters.county!.toLowerCase()))
      : undefined;

    const cities = filters.city
      ? [filters.city]
      : CITIES_BY_STATE[state] ?? ["Springfield"];

    // ZIP pool: explicit zip wins; else county zips; else synthesized
    const zipPool: string[] | undefined = filters.zip
      ? [filters.zip]
      : countyMatch?.zips;

    const types = filters.distressTypes?.length ? filters.distressTypes : ALL_TYPES;
    const limit = Math.min(filters.limit ?? 50, 200);

    const out: DistressedPropertyRecord[] = [];
    let i = 0;
    while (out.length < limit) {
      const city = filters.city ?? pick(cities, i);
      const county = countyMatch?.name
        ?? (filters.county ?? `${city} County`);
      const zip = zipPool
        ? pick(zipPool, i)
        : String(10_000 + ((hash(state + city) + i) % 89_999)).slice(0, 5);
      const distressType = pick(types, i);
      const rec = buildRecord(state, city, zip, county, i, distressType);

      if (filters.minEquity != null && (rec.equity ?? 0) < filters.minEquity) { i++; continue; }
      if (filters.minDaysOnMarket != null && (rec.daysOnMarket ?? 0) < filters.minDaysOnMarket) { i++; continue; }
      if (filters.minListPrice != null && (rec.listPrice ?? 0) < filters.minListPrice) { i++; continue; }
      if (filters.maxListPrice != null && (rec.listPrice ?? Number.MAX_SAFE_INTEGER) > filters.maxListPrice) { i++; continue; }
      if (filters.minBeds != null && (rec.beds ?? 0) < filters.minBeds) { i++; continue; }

      out.push(rec);
      i++;
      if (i > limit * 10) break; // safety
    }
    return out;
  }
}

export function getProvider(): PropertyProvider {
  // Future: switch on process.env.PROPERTY_PROVIDER === 'attom' | 'batchdata' | ...
  return new MockProvider();
}
