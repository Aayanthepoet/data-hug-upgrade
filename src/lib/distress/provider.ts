// Provider-agnostic distressed-property data interface.
// Swap MockProvider for an ATTOM / BatchData / Estated adapter without
// changing any server function or UI code.

export type DistressType =
  | "reo"
  | "preforeclosure"
  | "auction"
  | "tax_lien"
  | "tax_delinquent"
  | "fsbo_stale"
  | "vacant"
  | "absentee"
  | "hpd_litigation"
  | "eviction"
  | "vacate_order"
  | "code_violation"
  | "unsafe_structure"
  | "sheriff_sale";


export type ZoningCategory = "two_plus" | "single_only" | "any";

export interface DistressSearchFilters {
  state?: string;
  county?: string;
  city?: string;
  zip?: string;
  distressTypes?: DistressType[];
  minEquity?: number;
  minDaysOnMarket?: number;
  minListPrice?: number;
  maxListPrice?: number;
  minBeds?: number;
  /** Philadelphia only — filter by base zoning permitted-use category. */
  zoningCategory?: ZoningCategory;
  limit?: number;
}

// Philadelphia base-zoning code buckets — see https://www.phila.gov/CityPlanning/
// Two-family / multi-family permitted by right:
export const PHL_ZONING_TWO_PLUS = [
  "RTA1",
  "RM1", "RM2", "RM3", "RM4",
  "RMX1", "RMX2", "RMX3",
  "CMX1", "CMX2", "CMX2.5", "CMX3", "CMX4", "CMX5",
];
// Single-family only (baseline / for comparison):
export const PHL_ZONING_SINGLE = [
  "RSD1", "RSD2", "RSD3",
  "RSA1", "RSA2", "RSA3", "RSA4", "RSA5", "RSA6",
];

export interface DistressedPropertyRecord {
  sourceRecordId: string;
  /** Optional: if a wrapper provider returns rows from multiple datasets,
   * each row can carry its own source_provider name for accurate upserts. */
  sourceProvider?: string;

  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  county: string | null;
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  estimatedValue: number | null;
  equity: number | null;
  listPrice: number | null;
  listDate: string | null; // ISO date
  daysOnMarket: number | null;
  auctionDate: string | null;
  taxOwed: number | null;
  lienAmount: number | null;
  /** Philadelphia base-zoning code (e.g. "RM1", "RSA5") when available. */
  zoningCode?: string | null;
  /** Philadelphia long zoning code (e.g. "RM-1"). */
  zoningLongCode?: string | null;
  distressType: DistressType;
  listingStatus:
    | "active"
    | "pending"
    | "sold"
    | "off_market"
    | "auction_scheduled"
    | "foreclosed"
    | null;
  ownerName: string | null;
  isAbsentee: boolean;
  isVacant: boolean;
  lat: number | null;
  lng: number | null;
}

export interface PropertyProvider {
  readonly name: string;
  searchDistressed(filters: DistressSearchFilters): Promise<DistressedPropertyRecord[]>;
}
