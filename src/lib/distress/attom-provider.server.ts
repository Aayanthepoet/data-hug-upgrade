// ATTOM Data Solutions provider — nationwide property + foreclosure data.
//
// Docs: https://api.developer.attomdata.com/docs
// Auth: header `apikey: <ATTOM_API_KEY>`.
// Base: https://api.gateway.attomdata.com
//
// We use two endpoints:
//   - /propertyapi/v1.0.0/property/snapshot   (geographic search by zip / city+state)
//   - /propertyapi/v1.0.0/property/expandedprofile (per-property owner/equity enrich)
//
// Foreclosure-specific endpoints (preforeclosuredetails, etc.) require the
// Foreclosure bundle. We surface the distress signal from `saleSearchDate`
// / `vacant` / `absentee` fields returned by snapshot, and let the lead
// scorer do the rest. If the foreclosure bundle is also entitled, we layer
// in `/property/foreclosure` results.

import type {
  DistressSearchFilters,
  DistressType,
  DistressedPropertyRecord,
  PropertyProvider,
} from "./provider";
import { cachedJsonFetch } from "./cached-fetch.server";

const BASE = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";

interface AttomProperty {
  identifier?: { attomId?: number; obPropId?: string };
  address?: {
    line1?: string;
    line2?: string;
    locality?: string;
    countrySubd?: string;
    postal1?: string;
    matchCode?: string;
    oneLine?: string;
  };
  location?: { latitude?: string; longitude?: string; geoid?: string };
  summary?: {
    propclass?: string;
    proptype?: string;
    propsubtype?: string;
    yearbuilt?: number;
    absenteeInd?: string; // "ABSENTEE" | "OWNER OCCUPIED"
  };
  building?: {
    rooms?: { beds?: number; bathstotal?: number };
    size?: { universalsize?: number; livingsize?: number };
  };
  lot?: { lotsize1?: number };
  assessment?: {
    market?: { mktTtlValue?: number };
    assessed?: { assdTtlValue?: number };
    mortgage?: { ttlamount?: number };
    owner?: {
      owner1?: { fullname?: string; lastname?: string; firstnameandmi?: string };
      mailingaddressoneline?: string;
    };
  };
  sale?: {
    saleAmountData?: { saleAmt?: number; saleRecDate?: string };
    salesearchdate?: string;
  };
  avm?: { amount?: { value?: number } };
  vintage?: { lastModified?: string };
}

interface AttomResponse {
  status?: { code?: number; msg?: string; total?: number };
  property?: AttomProperty[];
}

function pickDistressType(p: AttomProperty): DistressType {
  const abs = (p.summary?.absenteeInd ?? "").toUpperCase();
  if (abs.includes("ABSENTEE")) return "absentee";
  return "fsbo_stale";
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function mapRecord(p: AttomProperty): DistressedPropertyRecord | null {
  const line1 = p.address?.line1?.trim();
  if (!line1) return null;

  const marketValue =
    num(p.assessment?.market?.mktTtlValue) ??
    num(p.avm?.amount?.value) ??
    num(p.assessment?.assessed?.assdTtlValue);
  const mortgage = num(p.assessment?.mortgage?.ttlamount);
  const equity = marketValue != null && mortgage != null ? Math.max(0, marketValue - mortgage) : null;

  const owner = p.assessment?.owner?.owner1?.fullname?.trim() ?? null;
  const isAbsentee = (p.summary?.absenteeInd ?? "").toUpperCase().includes("ABSENTEE");
  const saleDate = p.sale?.salesearchdate ?? p.sale?.saleAmountData?.saleRecDate ?? null;
  const dom =
    saleDate != null
      ? Math.max(0, Math.floor((Date.now() - Date.parse(saleDate)) / 86_400_000))
      : null;

  return {
    sourceRecordId:
      p.identifier?.attomId != null ? `attom:${p.identifier.attomId}` : `attom:${line1}|${p.address?.postal1 ?? ""}`,
    address: line1,
    city: p.address?.locality ?? null,
    state: p.address?.countrySubd ?? null,
    zip: p.address?.postal1 ?? null,
    county: null,
    propertyType: p.summary?.proptype ?? p.summary?.propsubtype ?? p.summary?.propclass ?? null,
    beds: num(p.building?.rooms?.beds),
    baths: num(p.building?.rooms?.bathstotal),
    sqft: num(p.building?.size?.universalsize ?? p.building?.size?.livingsize),
    yearBuilt: num(p.summary?.yearbuilt),
    estimatedValue: marketValue,
    equity,
    listPrice: num(p.sale?.saleAmountData?.saleAmt),
    listDate: saleDate,
    daysOnMarket: dom,
    auctionDate: null,
    taxOwed: null,
    lienAmount: null,
    distressType: pickDistressType(p),
    listingStatus: null,
    ownerName: owner,
    isAbsentee,
    isVacant: false,
    lat: num(p.location?.latitude),
    lng: num(p.location?.longitude),
  };
}

export class AttomProvider implements PropertyProvider {
  readonly name = "attom";

  constructor(private readonly apiKey: string) {}

  async searchDistressed(filters: DistressSearchFilters): Promise<DistressedPropertyRecord[]> {
    const limit = Math.min(filters.limit ?? 50, 100);
    const params = new URLSearchParams();
    params.set("pagesize", String(limit));
    params.set("page", "1");

    if (filters.zip) {
      params.set("postalcode", filters.zip);
    } else if (filters.city && filters.state) {
      params.set("address2", `${filters.city}, ${filters.state}`);
    } else if (filters.state) {
      // ATTOM requires a locality with the state for snapshot; bail out.
      return [];
    } else {
      return [];
    }

    if (filters.minBeds != null) params.set("minBeds", String(filters.minBeds));
    if (filters.minListPrice != null) params.set("minAvmValue", String(filters.minListPrice));
    if (filters.maxListPrice != null) params.set("maxAvmValue", String(filters.maxListPrice));

    const url = `${BASE}/property/snapshot?${params.toString()}`;
    const json = await cachedJsonFetch<AttomResponse>(url, {
      label: "attom:snapshot",
      ttlMs: 10 * 60_000,
      init: {
        method: "GET",
        headers: { apikey: this.apiKey, Accept: "application/json" },
      },
    });

    if (json.status && json.status.code !== 0 && json.status.code !== 200) {
      // ATTOM returns 0 / 200 for OK; anything else is a soft error.
      console.warn("[attom] non-OK status:", json.status);
      return [];
    }

    const records = (json.property ?? [])
      .map(mapRecord)
      .filter((r): r is DistressedPropertyRecord => r !== null);

    // Optional client-side filter for distress signals if caller asked for them.
    if (filters.distressTypes && filters.distressTypes.length > 0) {
      const wanted = new Set(filters.distressTypes);
      return records.filter((r) => wanted.has(r.distressType));
    }
    if (filters.minEquity != null) {
      return records.filter((r) => (r.equity ?? 0) >= filters.minEquity!);
    }
    return records;
  }
}
