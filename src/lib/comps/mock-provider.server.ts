import type { CompRecord, CompsProvider, CompsSubject } from "./provider";

// Deterministic hash so the same subject always returns the same comps.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x % 100000) / 100000;
  };
}

// ZIP-level baseline price-per-sqft (very rough, mock only).
function baselinePpsf(state: string | null, zip: string | null): number {
  const s = (state ?? "").toUpperCase();
  if (s === "NY") return 850;
  if (s === "CA") return 620;
  if (s === "MA") return 540;
  if (s === "WA") return 480;
  if (s === "FL") return 320;
  if (s === "TX") return 240;
  if (s === "PA") return 220;
  if (s === "OH" || s === "MI") return 160;
  // small zip-based jitter so different zips diverge
  const z = zip ? hash(zip) % 200 : 0;
  return 200 + z;
}

const STREETS = [
  "Maple Ave", "Oak St", "Cedar Ln", "Birch Rd", "Elm St",
  "Pine St", "Willow Way", "Sycamore Dr", "Chestnut St", "Walnut Ave",
];

export const mockCompsProvider: CompsProvider = {
  async fetchComps(subject: CompsSubject, limit: number): Promise<CompRecord[]> {
    const seed = hash(`${subject.id}|${subject.address}|${subject.zip ?? ""}`);
    const rand = rng(seed);
    const baseSqft = subject.sqft ?? 1400;
    const baseBeds = subject.beds ?? 3;
    const baseBaths = subject.baths ?? 2;
    const baseYear = subject.year_built ?? 1965;
    const ppsf = baselinePpsf(subject.state, subject.zip);

    const today = new Date();
    const out: CompRecord[] = [];
    for (let i = 0; i < limit; i++) {
      // sqft within ±25% of subject
      const sqftJitter = 1 + (rand() - 0.5) * 0.5;
      const sqft = Math.max(500, Math.round(baseSqft * sqftJitter));
      // ppsf within ±18%
      const localPpsf = ppsf * (1 + (rand() - 0.5) * 0.36);
      const sale_price = Math.round((sqft * localPpsf) / 1000) * 1000;

      // sale date: spread over last 9 months
      const daysAgo = Math.floor(rand() * 270) + 7;
      const d = new Date(today);
      d.setDate(d.getDate() - daysAgo);
      const sale_date = d.toISOString().slice(0, 10);

      const distance_miles = Math.round((0.1 + rand() * 1.4) * 100) / 100;
      const beds = Math.max(1, baseBeds + (rand() < 0.5 ? 0 : rand() < 0.5 ? -1 : 1));
      const baths = Math.max(1, Math.round((baseBaths + (rand() - 0.5)) * 2) / 2);
      const year_built = Math.max(1880, baseYear + Math.floor((rand() - 0.5) * 30));

      // Similarity: closer sqft + closer distance = higher
      const sqftDelta = Math.abs(sqft - baseSqft) / Math.max(baseSqft, 1);
      const similarity_score = Math.max(
        35,
        Math.min(99, Math.round(100 - sqftDelta * 80 - distance_miles * 15)),
      );

      const streetNum = 100 + Math.floor(rand() * 9000);
      const street = STREETS[Math.floor(rand() * STREETS.length)];

      out.push({
        address: `${streetNum} ${street}`,
        city: subject.city,
        state: subject.state,
        zip: subject.zip,
        sale_price,
        sale_date,
        distance_miles,
        sqft,
        beds: Number(beds),
        baths: Number(baths),
        year_built,
        property_type: subject.property_type ?? "single_family",
        similarity_score,
        source_provider: "mock",
        source_record_id: `mock-${seed}-${i}`,
      });
    }

    // Sort by similarity desc, then most recent
    out.sort((a, b) =>
      b.similarity_score - a.similarity_score ||
      b.sale_date.localeCompare(a.sale_date),
    );
    return out;
  },
};
