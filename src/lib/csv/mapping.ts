// CSV → property mapping: target fields, header auto-detection, distress
// normalization, dedupe key, and per-row validation.

export type TargetField =
  | "address"
  | "city"
  | "state"
  | "zip"
  | "owner_name"
  | "owner_mailing_address"
  | "distress_type"
  | "estimated_value"
  | "beds"
  | "baths"
  | "notes";

export const TARGET_FIELDS: { value: TargetField; label: string; required?: boolean }[] = [
  { value: "address", label: "Address", required: true },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "zip", label: "ZIP" },
  { value: "owner_name", label: "Owner Name" },
  { value: "owner_mailing_address", label: "Owner Mailing Address" },
  { value: "distress_type", label: "Distress Type / Status" },
  { value: "estimated_value", label: "Estimated Value" },
  { value: "beds", label: "Beds" },
  { value: "baths", label: "Baths" },
  { value: "notes", label: "Notes" },
];

const ALIASES: Record<TargetField, string[]> = {
  address: ["address", "property address", "site address", "street", "street address", "property", "addr", "situs address"],
  city: ["city", "town", "municipality", "property city", "situs city"],
  state: ["state", "st", "province", "property state", "situs state"],
  zip: ["zip", "zipcode", "zip code", "postal", "postal code", "property zip", "situs zip"],
  owner_name: ["owner", "owner 1", "owner1", "owner name", "current owner", "owner full name", "owners"],
  owner_mailing_address: ["mailing address", "owner address", "owner mailing", "owner mailing address", "mail address"],
  distress_type: ["status", "distress", "distress type", "type", "stage", "listing status", "foreclosure status"],
  estimated_value: ["value", "estimated value", "list price", "price", "avm", "market value", "asking price", "list_price"],
  beds: ["beds", "bedrooms", "br", "bed"],
  baths: ["baths", "bathrooms", "ba", "bath"],
  notes: ["notes", "comments", "remarks", "description"],
};

const norm = (s: string) => s.toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();

export function autoDetectMapping(headers: string[]): Partial<Record<TargetField, string>> {
  const out: Partial<Record<TargetField, string>> = {};
  const used = new Set<string>();
  for (const field of TARGET_FIELDS) {
    const aliases = ALIASES[field.value].map(norm);
    const match = headers.find((h) => !used.has(h) && aliases.includes(norm(h)));
    if (match) {
      out[field.value] = match;
      used.add(match);
    }
  }
  return out;
}

export type DistressType =
  | "reo" | "preforeclosure" | "auction" | "tax_lien"
  | "tax_delinquent" | "fsbo_stale" | "vacant" | "absentee" | "none";

export function normalizeDistress(raw: string | undefined | null): DistressType {
  if (!raw) return "none";
  const s = raw.toLowerCase().trim();
  if (!s) return "none";
  if (/(reo|bank[\s-]?owned|foreclosed|bank owned)/.test(s)) return "reo";
  if (/(pre[\s-]?foreclos|nod|notice of default|lis pendens)/.test(s)) return "preforeclosure";
  if (/(auction|sheriff|trustee sale)/.test(s)) return "auction";
  if (/tax\s*lien/.test(s)) return "tax_lien";
  if (/tax\s*delinq/.test(s)) return "tax_delinquent";
  if (/vacant/.test(s)) return "vacant";
  if (/absentee/.test(s)) return "absentee";
  if (/(fsbo|for sale by owner|stale)/.test(s)) return "fsbo_stale";
  return "none"; // honest default — we don't guess
}

export function normalizeAddressKey(address: string, zip?: string | null): string {
  const a = address.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const z = (zip ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  return `${a}|${z}`;
}

function parseNumber(v: string | undefined): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export type MappedRow = {
  ok: true;
  record: {
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    owner_name: string | null;
    owner_mailing: string | null;
    distress_type: DistressType;
    estimated_value: number | null;
    beds: number | null;
    baths: number | null;
    notes: string | null;
    source_record_id: string;
  };
} | { ok: false; reason: string };

export function mapRow(
  row: Record<string, string>,
  mapping: Partial<Record<TargetField, string>>,
): MappedRow {
  const get = (f: TargetField) => {
    const h = mapping[f];
    if (!h) return "";
    const v = row[h];
    return typeof v === "string" ? v.trim() : "";
  };

  const address = get("address");
  if (!address) return { ok: false, reason: "Missing address" };

  const city = get("city") || null;
  const stateRaw = get("state");
  const state = stateRaw ? stateRaw.toUpperCase().slice(0, 2) : null;
  const zip = get("zip") || null;

  if (!zip && !(city && state)) {
    return { ok: false, reason: "Missing ZIP or City+State" };
  }

  const owner_name = get("owner_name") || null;
  const owner_mailing = get("owner_mailing_address") || null;
  const csvNotes = get("notes");
  const ownerNote = [
    owner_name ? `Owner: ${owner_name}` : null,
    owner_mailing ? `Owner mailing: ${owner_mailing}` : null,
  ].filter(Boolean).join(" — ");
  const notes = [ownerNote, csvNotes].filter(Boolean).join("\n") || null;

  return {
    ok: true,
    record: {
      address,
      city,
      state,
      zip,
      owner_name,
      owner_mailing,
      distress_type: normalizeDistress(get("distress_type")),
      estimated_value: parseNumber(get("estimated_value")),
      beds: parseNumber(get("beds")),
      baths: parseNumber(get("baths")),
      notes,
      source_record_id: normalizeAddressKey(address, zip),
    },
  };
}
