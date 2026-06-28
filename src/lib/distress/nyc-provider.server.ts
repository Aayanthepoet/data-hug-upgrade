// NYC live data provider — one free public Socrata dataset:
//   - PLUTO Primary Land Use Tax Lot Output (`64uk-42ks`) → owner / value
//     records used as "absentee" leads when filters select residential lots.
// No API key required. Free public endpoints.
//
// NYC Open Data does NOT publish a foreclosure / pre-foreclosure / lis-pendens
// dataset. The old HPD dataset `9y3g-c5g6` was retired and not replaced;
// foreclosure filings live in the NYS court system (NYSCEF), not here.
// PLUTO rows are property/owner records — labeled `absentee`, NEVER as
// foreclosure.
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

// ----- HPD Pre-Foreclosure Notices: REMOVED -----
// Dataset `9y3g-c5g6` was retired by NYC Open Data and has no replacement.
// We intentionally do NOT substitute another dataset and call it foreclosure
// data. If/when NYC publishes a real pre-foreclosure or lis-pendens feed,
// reintroduce a fetcher here.


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
      filters.distressTypes?.length ? filters.distressTypes : ["absentee"],
    );

    const tasks: Promise<DistressedPropertyRecord[]>[] = [];
    if (types.has("absentee")) {
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

    // NYC Distress Signals — only fired when a signal type is explicitly
    // requested and a ZIP is provided (every signal dataset filters by ZIP).
    const signalMap: Record<string, "nyc_dof_tax_lien" | "nyc_hpd_litigation" | "nyc_marshal_eviction" | "nyc_dob_vacate"> = {
      tax_lien: "nyc_dof_tax_lien",
      hpd_litigation: "nyc_hpd_litigation",
      eviction: "nyc_marshal_eviction",
      vacate_order: "nyc_dob_vacate",
    };
    if (filters.zip) {
      const { fetchNYCSignal } = await import("./nyc-signals-provider.server");
      for (const [t, provider] of Object.entries(signalMap)) {
        if (!types.has(t as DistressType)) continue;
        tasks.push(
          fetchNYCSignal(provider, filters.zip, limit)
            .then((rows) => rows.map((r) => ({ ...r, sourceProvider: provider })))
            .catch((e) => {
              console.error(`[nyc-signals] ${provider} fetch failed:`, e);
              return [];
            }),
        );
      }
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

