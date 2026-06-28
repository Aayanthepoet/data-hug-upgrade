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
  | "vacate_order";


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
  limit?: number;
}

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
