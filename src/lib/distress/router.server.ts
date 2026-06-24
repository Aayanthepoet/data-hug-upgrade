// Routes a distressed-property search to the best available provider:
//   - NYC boroughs → NYCOpenDataProvider (free public Socrata APIs)
//   - Philadelphia → PhillyCartoProvider (free public Carto SQL API)
//   - Everywhere else → MockProvider (deterministic synthetic data)

import type {
  DistressSearchFilters,
  DistressedPropertyRecord,
  PropertyProvider,
} from "./provider";
import { isNYC, NYCOpenDataProvider } from "./nyc-provider.server";
import { isPhilly, PhillyCartoProvider } from "./philly-provider.server";
import { MockProvider } from "./mock-provider.server";
import { AttomProvider } from "./attom-provider.server";

export function selectProvider(filters: DistressSearchFilters): PropertyProvider {
  if (isNYC(filters)) return new NYCOpenDataProvider();
  if (isPhilly(filters)) return new PhillyCartoProvider();
  const attomKey = process.env.ATTOM_API_KEY;
  if (attomKey && (filters.zip || (filters.city && filters.state))) {
    return new AttomProvider(attomKey);
  }
  return new MockProvider();
}

export async function searchDistressedViaRouter(
  filters: DistressSearchFilters,
): Promise<{ records: DistressedPropertyRecord[]; provider: string; usedFallback: boolean }> {
  const provider = selectProvider(filters);
  try {
    const records = await provider.searchDistressed(filters);
    // If a live provider returns zero rows, fall back to mock so the UI still
    // has something to show — but flag it so we can surface "no live matches".
    if (records.length === 0 && provider.name !== "mock") {
      const mock = new MockProvider();
      return {
        records: await mock.searchDistressed(filters),
        provider: provider.name,
        usedFallback: true,
      };
    }
    return { records, provider: provider.name, usedFallback: false };
  } catch (e) {
    console.error(`[distress] provider ${provider.name} failed:`, e);
    const mock = new MockProvider();
    return {
      records: await mock.searchDistressed(filters),
      provider: provider.name,
      usedFallback: true,
    };
  }
}
