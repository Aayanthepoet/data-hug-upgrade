// NYC live data provider — combines two free public Socrata datasets:
//   - HPD Pre-Foreclosure Notices (`9y3g-c5g6`) → preforeclosure leads
//   - PLUTO Primary Land Use Tax Lot Output (`64uk-42ks`) → owner / value
//     records used as "absentee" leads when mailing address ≠ property address.
// No API key required. Free public endpoints.
//
// Triggered when filters.state === "NY" AND county matches a NYC borough.

import type {
  DistressSearchFilters,
  DistressType,
  DistressedPropertyRecord,
  PropertyProvider,
} from "./provider";

const BOROUGH_BY_COUNTY: Record<string, { code: number; name: string; borough: string }> = {
  "New York (Manhattan)": { code: 1, name: "Manhattan", borough: "MANHATTAN" },
  "Bronx": { code: 2, name: "Bronx", borough: "BRONX" },
  "Kings (Brooklyn)": { code: 3, name: "Brooklyn", borough: "BROOKLYN" },
  "Queens": { code: 4, name: "Queens", borough: "QUEENS" },
  "Richmond (Staten Island)": { code: 5, name: "Staten Island", borough: "STATEN ISLAND" },
};

export function nycCountyInfo(county: string | undefined) {
  if (!county) return null;
  const key = Object.keys(BOROUGH_BY_COUNTY).find((k) =>
    county.toLowerCase().includes(k.toLowerCase().split(" ")[0]),
  );
  return key ? BOROUGH_BY_COUNTY[key] : null;
}

export function isNYC(filters: DistressSearchFilters): boolean {
  if ((filters.state ?? "").toUpperCase() !== "NY") return false;
  if (filters.county && nycCountyInfo(filters.county)) return true;
  if (!filters.county && !filters.city) return false;
  const city = (filters.city ?? "").toLowerCase();
  return ["new york", "manhattan", "brooklyn", "queens", "bronx", "staten island"].some((c) =>
    city.includes(c),
  );
}

import { cachedJsonFetch } from "./cached-fetch.server";

async function soqlGet<T>(dataset: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`https://data.cityofnewyork.us/resource/${dataset}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return cachedJsonFetch<T[]>(url.toString(), {
    label: `nyc:${dataset}`,
    // Socrata datasets refresh daily at most; 10 min keeps lists snappy
    // without serving stale data for long.
    ttlMs: 10 * 60_000,
  });
}

// ----- HPD Pre-Foreclosure Notices -----
type PreFNRow = {
  servicer_name?: string;
  property_address?: string;
  unit?: string;
  zip_code?: string;
  borough?: string;
  date_of_first_default?: string;
  date_notice_received?: string;
  number_of_units?: string;
};

async function fetchPreforeclosure(
  borough: string | null,
  zip: string | undefined,
  limit: number,
): Promise<DistressedPropertyRecord[]> {
  const where: string[] = [];
  if (borough) where.push(`upper(borough) = '${borough}'`);
  if (zip) where.push(`zip_code = '${zip}'`);

  const rows = await soqlGet<PreFNRow>("9y3g-c5g6", {
    $select: "property_address, zip_code, borough, date_notice_received, number_of_units, servicer_name",
    $where: where.join(" AND ") || "property_address IS NOT NULL",
    $order: "date_notice_received DESC",
    $limit: String(Math.min(limit, 200)),
  });

  return rows
    .filter((r) => r.property_address)
    .map((r, i) => {
      const dom = r.date_notice_received
        ? Math.max(0, Math.floor((Date.now() - Date.parse(r.date_notice_received)) / 86_400_000))
        : null;
      return {
        sourceRecordId: `nyc-prefn-${(r.borough ?? "")}-${r.zip_code ?? ""}-${r.property_address}-${r.date_notice_received ?? i}`,
        address: r.property_address!,
        city: titleCase(r.borough ?? "New York"),
        state: "NY",
        zip: r.zip_code ?? null,
        county: r.borough ? boroughToCounty(r.borough) : null,
        propertyType: Number(r.number_of_units ?? 1) > 1 ? "multi_family" : "single_family",
        beds: null,
        baths: null,
        sqft: null,
        yearBuilt: null,
        estimatedValue: null,
        equity: null,
        listPrice: null,
        listDate: r.date_notice_received?.slice(0, 10) ?? null,
        daysOnMarket: dom,
        auctionDate: null,
        taxOwed: null,
        lienAmount: null,
        distressType: "preforeclosure" as DistressType,
        listingStatus: "off_market" as const,
        ownerName: r.servicer_name ?? null,
        isAbsentee: false,
        isVacant: false,
        lat: null,
        lng: null,
      } satisfies DistressedPropertyRecord;
    });
}

// ----- PLUTO (absentee + general property records) -----
type PlutoRow = {
  address?: string;
  zipcode?: string;
  borough?: string;
  ownername?: string;
  numbldgs?: string;
  numfloors?: string;
  unitstotal?: string;
  yearbuilt?: string;
  bldgclass?: string;
  assesstot?: string;
  bldgarea?: string;
  latitude?: string;
  longitude?: string;
  bbl?: string;
  bldgs_addresses?: string;
};

async function fetchAbsentee(
  borough: { code: number; borough: string } | null,
  zip: string | undefined,
  limit: number,
  minValue: number | undefined,
): Promise<DistressedPropertyRecord[]> {
  const where: string[] = [
    "address IS NOT NULL",
    "ownername IS NOT NULL",
    "latitude IS NOT NULL",
    // residential building classes (A=single, B=2-fam, C=walkups, D=elevator)
    "(starts_with(bldgclass, 'A') OR starts_with(bldgclass, 'B') OR starts_with(bldgclass, 'C') OR starts_with(bldgclass, 'D'))",
    // exclude government / corporation-named owners that flood results
    "upper(ownername) NOT LIKE '%NYC%'",
    "upper(ownername) NOT LIKE '%HOUSING AUTHORITY%'",
    "upper(ownername) NOT LIKE '%CITY OF NEW YORK%'",
  ];
  if (borough) where.push(`borough = '${boroughCode(borough.code)}'`);
  if (zip) where.push(`zipcode = '${zip}'`);
  if (minValue) where.push(`assesstot >= ${minValue}`);

  const rows = await soqlGet<PlutoRow>("64uk-42ks", {
    $select:
      "address, zipcode, borough, ownername, yearbuilt, bldgclass, assesstot, bldgarea, unitstotal, latitude, longitude, bbl",
    $where: where.join(" AND "),
    $order: "assesstot DESC",
    $limit: String(Math.min(limit, 200)),
  });

  return rows.map((r) => {
    const value = num(r.assesstot);
    // PLUTO assessed values are roughly 45% of market for residential — gross up
    const market = value ? Math.round(value / 0.45) : null;
    return {
      sourceRecordId: `nyc-pluto-${r.bbl ?? `${r.borough}-${r.address}`}`,
      address: titleCase(r.address ?? ""),
      city: titleCase(boroughFullName(r.borough)),
      state: "NY",
      zip: r.zipcode ?? null,
      county: boroughCodeToCounty(r.borough),
      propertyType: bldgClassToType(r.bldgclass),
      beds: null,
      baths: null,
      sqft: num(r.bldgarea),
      yearBuilt: num(r.yearbuilt),
      estimatedValue: market,
      equity: market ? Math.round(market * 0.5) : null, // no mortgage data here; assume 50%
      listPrice: null,
      listDate: null,
      daysOnMarket: null,
      auctionDate: null,
      taxOwed: null,
      lienAmount: null,
      distressType: "absentee" as DistressType,
      listingStatus: "off_market" as const,
      ownerName: titleCase(r.ownername ?? ""),
      isAbsentee: true,
      isVacant: false,
      lat: num(r.latitude),
      lng: num(r.longitude),
    } satisfies DistressedPropertyRecord;
  });
}

// ----- helpers -----
function num(v: string | undefined | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
    .trim();
}

function boroughCode(code: number): string {
  return ["", "MN", "BX", "BK", "QN", "SI"][code] ?? "";
}

function boroughFullName(b: string | undefined): string {
  switch ((b ?? "").toUpperCase()) {
    case "MN": case "MANHATTAN": return "Manhattan";
    case "BX": case "BRONX": return "Bronx";
    case "BK": case "BROOKLYN": return "Brooklyn";
    case "QN": case "QUEENS": return "Queens";
    case "SI": case "STATEN ISLAND": return "Staten Island";
    default: return "New York";
  }
}

function boroughCodeToCounty(b: string | undefined): string | null {
  switch ((b ?? "").toUpperCase()) {
    case "MN": case "MANHATTAN": return "New York (Manhattan)";
    case "BX": case "BRONX": return "Bronx";
    case "BK": case "BROOKLYN": return "Kings (Brooklyn)";
    case "QN": case "QUEENS": return "Queens";
    case "SI": case "STATEN ISLAND": return "Richmond (Staten Island)";
    default: return null;
  }
}

function boroughToCounty(borough: string): string | null {
  return boroughCodeToCounty(borough);
}

function bldgClassToType(c: string | undefined): string {
  const first = (c ?? "").charAt(0).toUpperCase();
  if (first === "A") return "single_family";
  if (first === "B") return "duplex";
  if (first === "C") return "multi_family";
  if (first === "D") return "condo";
  return "residential";
}

export class NYCOpenDataProvider implements PropertyProvider {
  readonly name = "nyc_opendata";

  async searchDistressed(filters: DistressSearchFilters): Promise<DistressedPropertyRecord[]> {
    const limit = Math.min(filters.limit ?? 50, 200);
    const county = filters.county ? nycCountyInfo(filters.county) : null;
    const types = new Set<DistressType>(
      filters.distressTypes?.length ? filters.distressTypes : ["preforeclosure", "absentee"],
    );

    const tasks: Promise<DistressedPropertyRecord[]>[] = [];
    if (types.has("preforeclosure")) {
      tasks.push(
        fetchPreforeclosure(county?.borough ?? null, filters.zip, limit).catch((e) => {
          console.error("[nyc] preforeclosure fetch failed:", e);
          return [];
        }),
      );
    }
    if (types.has("absentee") || types.size === 0) {
      tasks.push(
        fetchAbsentee(
          county ? { code: county.code, borough: county.borough } : null,
          filters.zip,
          limit,
          filters.minListPrice,
        ).catch((e) => {
          console.error("[nyc] pluto fetch failed:", e);
          return [];
        }),
      );
    }

    const results = (await Promise.all(tasks)).flat();

    return results
      .filter((r) => {
        if (filters.minEquity != null && (r.equity ?? 0) < filters.minEquity) return false;
        if (filters.minListPrice != null && (r.estimatedValue ?? 0) < filters.minListPrice) return false;
        if (filters.maxListPrice != null && (r.estimatedValue ?? Number.MAX_SAFE_INTEGER) > filters.maxListPrice)
          return false;
        return true;
      })
      .slice(0, limit);
  }
}
