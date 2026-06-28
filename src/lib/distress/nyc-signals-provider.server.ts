// NYC "Distress Signals" — four free NYC Open Data Socrata datasets, each
// mapped to a distinct distress_type and source_provider. These are NOT
// foreclosures; they are independent distress indicators (tax liens, HPD
// litigation, executed evictions, DOB vacate orders).
//
// Datasets:
//   - DOF Annual Tax Lien Sale List  (9rz4-mjek) → tax_lien
//   - HPD Litigations                 (59kj-x8nc) → hpd_litigation
//   - DOI Marshal Evictions           (6z8x-wfk4) → eviction (Residential + Possession)
//   - DOB Vacate Orders               (tb8q-a3ar) → vacate_order (active only)
//
// Filters applied server-side:
//   * Recent: last 12 months
//   * Targeted: ZIP (every dataset has a ZIP field)
//   * Active vacates: actual_rescind_date IS NULL
//   * Per-dataset, per-target row cap to keep sync bounded
//
// No geocoding here. Tax-lien rows have no lat/lng — we keep them null and
// geocode on demand if/when a user opens that property.

import type { DistressType, DistressedPropertyRecord } from "./provider";
import { cachedJsonFetch } from "./cached-fetch.server";

export type NYCSignalProvider =
  | "nyc_dof_tax_lien"
  | "nyc_hpd_litigation"
  | "nyc_marshal_eviction"
  | "nyc_dob_vacate";

export const NYC_SIGNAL_DISTRESS_TYPE: Record<NYCSignalProvider, DistressType> = {
  nyc_dof_tax_lien: "tax_lien",
  nyc_hpd_litigation: "hpd_litigation",
  nyc_marshal_eviction: "eviction",
  nyc_dob_vacate: "vacate_order",
};

/** Cap per (provider, target ZIP) per fetch. */
export const SIGNAL_PER_TARGET_LIMIT = 200;

const TWELVE_MONTHS_AGO = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().slice(0, 10);
};

async function soql<T>(dataset: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(`https://data.cityofnewyork.us/resource/${dataset}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return cachedJsonFetch<T[]>(url.toString(), {
    label: `nyc-signals:${dataset}`,
    ttlMs: 10 * 60_000,
  });
}

function num(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
    .trim();
}

function boroCodeName(c: string | undefined): string {
  switch ((c ?? "").toString()) {
    case "1": return "Manhattan";
    case "2": return "Bronx";
    case "3": return "Brooklyn";
    case "4": return "Queens";
    case "5": return "Staten Island";
    default: return titleCase(c ?? "");
  }
}

function boroToCounty(b: string | undefined): string | null {
  switch ((b ?? "").toUpperCase()) {
    case "MANHATTAN": case "1": case "MN": return "New York (Manhattan)";
    case "BRONX": case "2": case "BX": return "Bronx";
    case "BROOKLYN": case "3": case "BK": return "Kings (Brooklyn)";
    case "QUEENS": case "4": case "QN": return "Queens";
    case "STATEN ISLAND": case "5": case "SI": return "Richmond (Staten Island)";
    default: return null;
  }
}

/** Compute 10-char BBL from borough(1) + block(5) + lot(4). */
function computeBbl(borough: string | undefined, block: string | undefined, lot: string | undefined): string | null {
  const b = (borough ?? "").trim();
  const bl = (block ?? "").trim();
  const lt = (lot ?? "").trim();
  if (!b || !bl || !lt) return null;
  if (!/^[1-5]$/.test(b)) return null;
  return `${b}${bl.padStart(5, "0")}${lt.padStart(4, "0")}`;
}

// ----- Tax Lien -----
type TaxLienRow = {
  month?: string;
  cycle?: string;
  borough?: string;
  block?: string;
  lot?: string;
  house_number?: string;
  street_name?: string;
  zip_code?: string;
};

export async function fetchTaxLien(zip: string, limit: number): Promise<DistressedPropertyRecord[]> {
  const where = [
    `zip_code = '${zip}'`,
    `month >= '${TWELVE_MONTHS_AGO()}'`,
    "house_number IS NOT NULL",
    "street_name IS NOT NULL",
  ].join(" AND ");
  const rows = await soql<TaxLienRow>("9rz4-mjek", {
    $select: "month,cycle,borough,block,lot,house_number,street_name,zip_code",
    $where: where,
    $order: "month DESC",
    $limit: String(limit),
  });
  return rows.map((r) => {
    const bbl = computeBbl(r.borough, r.block, r.lot);
    const address = titleCase(`${r.house_number ?? ""} ${r.street_name ?? ""}`.trim());
    return {
      sourceRecordId: `nyc-taxlien-${bbl ?? `${r.borough}-${r.block}-${r.lot}`}-${r.month?.slice(0, 10) ?? ""}`,
      address,
      city: boroCodeName(r.borough),
      state: "NY",
      zip: r.zip_code ?? null,
      county: boroToCounty(r.borough),
      propertyType: null,
      beds: null, baths: null, sqft: null, yearBuilt: null,
      estimatedValue: null, equity: null,
      listPrice: null, listDate: null, daysOnMarket: null,
      auctionDate: null,
      taxOwed: null,
      lienAmount: null,
      distressType: "tax_lien",
      listingStatus: null,
      ownerName: null,
      isAbsentee: false,
      isVacant: false,
      lat: null,
      lng: null,
    } satisfies DistressedPropertyRecord;
  });
}

// ----- HPD Litigation -----
type HpdLitRow = {
  litigationid?: string;
  housenumber?: string;
  streetname?: string;
  zip?: string;
  boroid?: string;
  block?: string;
  lot?: string;
  casetype?: string;
  caseopendate?: string;
  casestatus?: string;
  respondent?: string;
  bbl?: string;
  latitude?: string;
  longitude?: string;
};

export async function fetchHpdLitigation(zip: string, limit: number): Promise<DistressedPropertyRecord[]> {
  const rows = await soql<HpdLitRow>("59kj-x8nc", {
    $select:
      "litigationid,housenumber,streetname,zip,boroid,block,lot,casetype,caseopendate,casestatus,respondent,bbl,latitude,longitude",
    $where: `zip = '${zip}' AND caseopendate >= '${TWELVE_MONTHS_AGO()}'`,
    $order: "caseopendate DESC",
    $limit: String(limit),
  });
  return rows.map((r) => ({
    sourceRecordId: `nyc-hpdlit-${r.litigationid ?? r.bbl ?? ""}`,
    address: titleCase(`${r.housenumber ?? ""} ${r.streetname ?? ""}`.trim()),
    city: boroCodeName(r.boroid),
    state: "NY",
    zip: r.zip ?? null,
    county: boroToCounty(r.boroid),
    propertyType: null,
    beds: null, baths: null, sqft: null, yearBuilt: null,
    estimatedValue: null, equity: null,
    listPrice: null, listDate: r.caseopendate?.slice(0, 10) ?? null,
    daysOnMarket: null,
    auctionDate: null,
    taxOwed: null, lienAmount: null,
    distressType: "hpd_litigation",
    listingStatus: null,
    ownerName: r.respondent ? titleCase(r.respondent.split(",")[0]) : null,
    isAbsentee: false,
    isVacant: false,
    lat: num(r.latitude),
    lng: num(r.longitude),
  } satisfies DistressedPropertyRecord));
}

// ----- Marshal Evictions -----
type EvictionRow = {
  court_index_number?: string;
  docket_number?: string;
  eviction_address?: string;
  eviction_apt_num?: string;
  executed_date?: string;
  borough?: string;
  eviction_zip?: string;
  residential_commercial_ind?: string;
  eviction_possession?: string;
  latitude?: string;
  longitude?: string;
  bbl?: string;
};

export async function fetchEvictions(zip: string, limit: number): Promise<DistressedPropertyRecord[]> {
  const where = [
    `eviction_zip = '${zip}'`,
    `executed_date >= '${TWELVE_MONTHS_AGO()}'`,
    "residential_commercial_ind = 'Residential'",
    "eviction_possession = 'Possession'",
  ].join(" AND ");
  const rows = await soql<EvictionRow>("6z8x-wfk4", {
    $select:
      "court_index_number,docket_number,eviction_address,eviction_apt_num,executed_date,borough,eviction_zip,latitude,longitude,bbl",
    $where: where,
    $order: "executed_date DESC",
    $limit: String(limit),
  });
  return rows.map((r) => ({
    sourceRecordId: `nyc-eviction-${r.court_index_number ?? ""}-${r.docket_number ?? ""}`,
    address: titleCase(r.eviction_address ?? ""),
    city: titleCase(r.borough ?? ""),
    state: "NY",
    zip: r.eviction_zip ?? null,
    county: boroToCounty(r.borough),
    propertyType: null,
    beds: null, baths: null, sqft: null, yearBuilt: null,
    estimatedValue: null, equity: null,
    listPrice: null, listDate: r.executed_date?.slice(0, 10) ?? null,
    daysOnMarket: null,
    auctionDate: null,
    taxOwed: null, lienAmount: null,
    distressType: "eviction",
    listingStatus: null,
    ownerName: null,
    isAbsentee: false,
    isVacant: true,
    lat: num(r.latitude),
    lng: num(r.longitude),
  } satisfies DistressedPropertyRecord));
}

// ----- DOB Vacate Orders (active only) -----
type VacateRow = {
  building_id?: string;
  vacate_order_number?: string;
  boro_short_name?: string;
  house_number?: string;
  street_name?: string;
  primary_vacate_reason?: string;
  vacate_type?: string;
  vacate_effective_date?: string;
  actual_rescind_date?: string;
  postoce?: string;
  latitude?: string;
  longitude?: string;
  bbl?: string;
};

export async function fetchVacateOrders(zip: string, limit: number): Promise<DistressedPropertyRecord[]> {
  const where = [
    `postoce = '${zip}'`,
    `vacate_effective_date >= '${TWELVE_MONTHS_AGO()}'`,
    "actual_rescind_date IS NULL",
  ].join(" AND ");
  const rows = await soql<VacateRow>("tb8q-a3ar", {
    $select:
      "building_id,vacate_order_number,boro_short_name,house_number,street_name,primary_vacate_reason,vacate_type,vacate_effective_date,actual_rescind_date,postoce,latitude,longitude,bbl",
    $where: where,
    $order: "vacate_effective_date DESC",
    $limit: String(limit),
  });
  return rows.map((r) => ({
    sourceRecordId: `nyc-vacate-${r.vacate_order_number ?? r.building_id ?? ""}`,
    address: titleCase(`${r.house_number ?? ""} ${r.street_name ?? ""}`.trim()),
    city: boroCodeName(r.boro_short_name === "MN" ? "1" : r.boro_short_name === "BX" ? "2" : r.boro_short_name === "BK" ? "3" : r.boro_short_name === "QN" ? "4" : r.boro_short_name === "SI" ? "5" : ""),
    state: "NY",
    zip: r.postoce ?? null,
    county: boroToCounty(r.boro_short_name),
    propertyType: null,
    beds: null, baths: null, sqft: null, yearBuilt: null,
    estimatedValue: null, equity: null,
    listPrice: null, listDate: r.vacate_effective_date?.slice(0, 10) ?? null,
    daysOnMarket: null,
    auctionDate: null,
    taxOwed: null, lienAmount: null,
    distressType: "vacate_order",
    listingStatus: null,
    ownerName: null,
    isAbsentee: false,
    isVacant: true,
    lat: num(r.latitude),
    lng: num(r.longitude),
  } satisfies DistressedPropertyRecord));
}

export async function fetchNYCSignal(
  provider: NYCSignalProvider,
  zip: string,
  limit = SIGNAL_PER_TARGET_LIMIT,
): Promise<DistressedPropertyRecord[]> {
  switch (provider) {
    case "nyc_dof_tax_lien": return fetchTaxLien(zip, limit);
    case "nyc_hpd_litigation": return fetchHpdLitigation(zip, limit);
    case "nyc_marshal_eviction": return fetchEvictions(zip, limit);
    case "nyc_dob_vacate": return fetchVacateOrders(zip, limit);
  }
}
