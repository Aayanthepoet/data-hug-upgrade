// Philadelphia "Distress Signals" — four free Carto SQL datasets, each mapped
// to a distinct distress_type and source_provider. Independent indicators, not
// all foreclosures.
//
// Datasets (phl.carto.com):
//   - real_estate_tax_balances JOIN opa_properties_public  → tax_delinquent  (phl_tax_delinquent)
//   - violations                                           → code_violation  (phl_li_violation)
//   - li_unsafe                                            → unsafe_structure (phl_unsafe)
//   - rtt_summary (SHERIFF deeds)                          → sheriff_sale    (phl_sheriff_deed)
//
// Server-side filters: ZIP + recency window + per-target row cap.

import type { DistressType, DistressedPropertyRecord } from "./provider";
import { cachedJsonFetch } from "./cached-fetch.server";

export type PhillySignalProvider =
  | "phl_tax_delinquent"
  | "phl_li_violation"
  | "phl_unsafe"
  | "phl_sheriff_deed";

export const PHILLY_SIGNAL_DISTRESS_TYPE: Record<PhillySignalProvider, DistressType> = {
  phl_tax_delinquent: "tax_delinquent",
  phl_li_violation: "code_violation",
  phl_unsafe: "unsafe_structure",
  phl_sheriff_deed: "sheriff_sale",
};

export const PHILLY_SIGNAL_PER_TARGET_LIMIT = 200;

const monthsAgoIso = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m);
  return d.toISOString().slice(0, 10);
};

async function cartoQuery<T>(sql: string): Promise<T[]> {
  const url = new URL("https://phl.carto.com/api/v2/sql");
  url.searchParams.set("q", sql);
  const json = await cachedJsonFetch<{ rows?: T[]; error?: string[] }>(url.toString(), {
    label: "philly-signals:carto",
    ttlMs: 10 * 60_000,
  });
  if (json.error) throw new Error(`Philly Carto: ${json.error.join("; ")}`);
  return json.rows ?? [];
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
    .trim();
}

function num(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function zip5(z: string | null | undefined): string | null {
  if (!z) return null;
  const m = z.match(/\d{5}/);
  return m ? m[0] : null;
}

const PHILLY_DEFAULT = {
  city: "Philadelphia",
  state: "PA",
  county: "Philadelphia",
  propertyType: null,
  beds: null, baths: null, sqft: null, yearBuilt: null,
  estimatedValue: null, equity: null,
  listPrice: null, daysOnMarket: null, auctionDate: null,
  taxOwed: null, lienAmount: null,
  listingStatus: null,
  isAbsentee: false,
  isVacant: false,
} as const;

// ----- Tax Delinquent (OPA join) -----
type TaxDelinqRow = {
  opa_account_num: string;
  location: string | null;
  zip_code: string | null;
  owner_1: string | null;
  market_value: number | null;
  tax_owed: number | null;
  lat: number | null;
  lng: number | null;
};

export async function fetchPhlTaxDelinquent(zip: string, limit: number): Promise<DistressedPropertyRecord[]> {
  const sql = `
    SELECT p.parcel_number AS opa_account_num, p.location, p.zip_code, p.owner_1,
           p.market_value, t.total AS tax_owed,
           ST_Y(p.the_geom) AS lat, ST_X(p.the_geom) AS lng
      FROM opa_properties_public p
      JOIN real_estate_tax_balances t ON t.opa_number = p.parcel_number
     WHERE p.zip_code LIKE '${zip}%'
       AND p.location IS NOT NULL
       AND p.the_geom IS NOT NULL
       AND p.category_code_description ILIKE '%residential%'
       AND t.total > 1000
     ORDER BY t.total DESC
     LIMIT ${limit}`;
  const rows = await cartoQuery<TaxDelinqRow>(sql);
  return rows.map((r) => ({
    sourceRecordId: `phl-taxdelq-${r.opa_account_num}`,
    address: titleCase(r.location ?? ""),
    zip: zip5(r.zip_code),
    ...PHILLY_DEFAULT,
    estimatedValue: r.market_value ?? null,
    equity: r.market_value ? Math.round(r.market_value * 0.5) : null,
    listDate: null,
    taxOwed: num(r.tax_owed),
    lienAmount: num(r.tax_owed),
    distressType: "tax_delinquent",
    ownerName: titleCase(r.owner_1 ?? ""),
    lat: num(r.lat),
    lng: num(r.lng),
  } satisfies DistressedPropertyRecord));
}

// ----- L&I Code Violations (open, recent) -----
type ViolationRow = {
  violationnumber: string | null;
  casenumber: string | null;
  parcel_id_num: string | null;
  address: string | null;
  zip: string | null;
  violationdate: string | null;
  violationcode: string | null;
  violationcodetitle: string | null;
  casestatus: string | null;
  lat: number | null;
  lng: number | null;
};

export async function fetchPhlViolations(zip: string, limit: number): Promise<DistressedPropertyRecord[]> {
  const since = monthsAgoIso(12);
  const sql = `
    SELECT violationnumber, casenumber, parcel_id_num, address, zip,
           violationdate, violationcode, violationcodetitle, casestatus,
           ST_Y(the_geom) AS lat, ST_X(the_geom) AS lng
      FROM violations
     WHERE zip LIKE '${zip}%'
       AND casestatus = 'IN VIOLATION'
       AND violationdate >= '${since}'
       AND address IS NOT NULL
     ORDER BY violationdate DESC
     LIMIT ${limit}`;
  const rows = await cartoQuery<ViolationRow>(sql);
  return rows.map((r) => ({
    sourceRecordId: `phl-violation-${r.violationnumber ?? r.casenumber ?? r.parcel_id_num ?? ""}`,
    address: titleCase(r.address ?? ""),
    zip: zip5(r.zip),
    ...PHILLY_DEFAULT,
    listDate: r.violationdate?.slice(0, 10) ?? null,
    distressType: "code_violation",
    ownerName: null,
    lat: num(r.lat),
    lng: num(r.lng),
  } satisfies DistressedPropertyRecord));
}

// ----- Unsafe Structures (li_unsafe, open cases) -----
type UnsafeRow = {
  casenumber: string | null;
  opa_account_num: string | null;
  address: string | null;
  zip: string | null;
  ownername: string | null;
  violationdate: string | null;
  caseresolutiondate: string | null;
  violationtype: string | null;
  lat: number | null;
  lng: number | null;
};

export async function fetchPhlUnsafe(zip: string, limit: number): Promise<DistressedPropertyRecord[]> {
  const since = monthsAgoIso(24);
  const sql = `
    SELECT casenumber, opa_account_num, address, zip, ownername,
           violationdate, caseresolutiondate, violationtype,
           ST_Y(the_geom) AS lat, ST_X(the_geom) AS lng
      FROM li_unsafe
     WHERE zip LIKE '${zip}%'
       AND caseresolutiondate IS NULL
       AND violationdate >= '${since}'
       AND address IS NOT NULL
     ORDER BY violationdate DESC
     LIMIT ${limit}`;
  const rows = await cartoQuery<UnsafeRow>(sql);
  return rows.map((r) => ({
    sourceRecordId: `phl-unsafe-${r.casenumber ?? r.opa_account_num ?? ""}`,
    address: titleCase(r.address ?? ""),
    zip: zip5(r.zip),
    ...PHILLY_DEFAULT,
    listDate: r.violationdate?.slice(0, 10) ?? null,
    distressType: "unsafe_structure",
    ownerName: r.ownername ? titleCase(r.ownername.split(/\s{2,}/)[0]) : null,
    lat: num(r.lat),
    lng: num(r.lng),
  } satisfies DistressedPropertyRecord));
}

// ----- Sheriff Deeds (rtt_summary) -----
type SheriffRow = {
  document_id: string | number | null;
  document_type: string | null;
  display_date: string | null;
  street_address: string | null;
  zip_code: string | null;
  grantors: string | null;
  grantees: string | null;
  cash_consideration: number | null;
  lat: number | null;
  lng: number | null;
};

export async function fetchPhlSheriffDeeds(zip: string, limit: number): Promise<DistressedPropertyRecord[]> {
  const since = monthsAgoIso(24);
  const sql = `
    SELECT document_id, document_type, display_date, street_address, zip_code,
           grantors, grantees, cash_consideration,
           ST_Y(the_geom) AS lat, ST_X(the_geom) AS lng
      FROM rtt_summary
     WHERE document_type IN ('SHERIFF''S DEED', 'DEED SHERIFF')
       AND zip_code LIKE '${zip}%'
       AND display_date >= '${since}'
       AND street_address IS NOT NULL
     ORDER BY display_date DESC
     LIMIT ${limit}`;
  const rows = await cartoQuery<SheriffRow>(sql);
  return rows.map((r) => ({
    sourceRecordId: `phl-sheriff-${r.document_id ?? ""}`,
    address: titleCase(r.street_address ?? ""),
    zip: zip5(r.zip_code),
    ...PHILLY_DEFAULT,
    listDate: r.display_date?.slice(0, 10) ?? null,
    listPrice: num(r.cash_consideration),
    distressType: "sheriff_sale",
    listingStatus: "foreclosed",
    ownerName: r.grantees ? titleCase(r.grantees.split(",")[0]) : null,
    lat: num(r.lat),
    lng: num(r.lng),
  } satisfies DistressedPropertyRecord));
}

export async function fetchPhillySignal(
  provider: PhillySignalProvider,
  zip: string,
  limit = PHILLY_SIGNAL_PER_TARGET_LIMIT,
): Promise<DistressedPropertyRecord[]> {
  switch (provider) {
    case "phl_tax_delinquent": return fetchPhlTaxDelinquent(zip, limit);
    case "phl_li_violation": return fetchPhlViolations(zip, limit);
    case "phl_unsafe": return fetchPhlUnsafe(zip, limit);
    case "phl_sheriff_deed": return fetchPhlSheriffDeeds(zip, limit);
  }
}
