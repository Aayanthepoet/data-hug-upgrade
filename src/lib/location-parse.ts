// Shared, dependency-free US address parser.
// Pulls city / state / zip out of free-form strings like:
//   "123 Main St, Brooklyn, NY 11201"
//   "Looking for deals in Austin, TX 78701"
//   "Neighborhood: Wynwood, Miami FL 33127"

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

export type ParsedLocation = {
  city: string | null;
  state: string | null;
  zip: string | null;
  neighborhood: string | null;
};

const ZIP_RE = /\b(\d{5})(?:-\d{4})?\b/;
// "City, ST 12345" or "City, ST" or "City ST 12345"
const CITY_STATE_ZIP_RE =
  /([A-Za-z][A-Za-z .'\-]{1,40}?)[, ]+([A-Z]{2})(?:\s+(\d{5})(?:-\d{4})?)?/g;
const NEIGHBORHOOD_RE = /neighborhood\s*[:\-]\s*([A-Za-z][A-Za-z .'\-]{1,60})/i;

export function parseLocation(input?: string | null): ParsedLocation {
  const out: ParsedLocation = { city: null, state: null, zip: null, neighborhood: null };
  if (!input) return out;
  const text = String(input);

  const nbh = text.match(NEIGHBORHOOD_RE);
  if (nbh) out.neighborhood = nbh[1].trim().replace(/[,.]+$/, "");

  // Try to find a valid "City, ST [ZIP]" segment.
  let match: RegExpExecArray | null;
  const re = new RegExp(CITY_STATE_ZIP_RE);
  while ((match = re.exec(text)) !== null) {
    const state = match[2].toUpperCase();
    if (!US_STATES.has(state)) continue;
    const city = match[1].trim().replace(/[,.]+$/, "");
    if (city.length < 2) continue;
    out.city = city;
    out.state = state;
    if (match[3]) out.zip = match[3];
    break;
  }

  // Fallback: bare 5-digit ZIP anywhere.
  if (!out.zip) {
    const z = text.match(ZIP_RE);
    if (z) out.zip = z[1];
  }

  return out;
}

/** Merge: prefer the existing value, fall back to parsed. */
export function mergeLocation<T extends Partial<ParsedLocation>>(
  existing: T,
  parsed: ParsedLocation,
): T {
  return {
    ...existing,
    city: (existing.city ?? parsed.city) || null,
    state: (existing.state ?? parsed.state) || null,
    zip: (existing.zip ?? parsed.zip) || null,
    neighborhood: (existing.neighborhood ?? parsed.neighborhood) || null,
  } as T;
}
