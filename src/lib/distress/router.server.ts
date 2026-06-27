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

export function selectProvider(filters: DistressSearchFilters): PropertyProvider | null {
  if (isNYC(filters)) return new NYCOpenDataProvider();
  if (isPhilly(filters)) return new PhillyCartoProvider();
  // ATTOM is paid. Gate behind ENABLE_ATTOM=true so out-of-coverage searches
  // return an honest empty state instead of silently billing.
  const attomEnabled = (process.env.ENABLE_ATTOM ?? "false").toLowerCase() === "true";
  const attomKey = process.env.ATTOM_API_KEY;
  if (attomEnabled && attomKey && (filters.zip || (filters.city && filters.state))) {
    return new AttomProvider(attomKey);
  }
  // Out of coverage and no paid provider enabled → no provider.
  return null;
}

export async function searchDistressedViaRouter(
  filters: DistressSearchFilters,
): Promise<{ records: DistressedPropertyRecord[]; provider: string; usedFallback: boolean }> {
  const provider = selectProvider(filters);
  try {
    const records = await provider.searchDistressed(filters);
    // Live provider with zero rows → return an honest empty result.
    // We only fall back to mock for the mock provider itself (unsupported markets),
    // never to fake out a real NYC / Philly / ATTOM search.
    return { records, provider: provider.name, usedFallback: false };
  } catch (e) {
    console.error(`[distress] provider ${provider.name} failed:`, e);
    // On a hard provider error, return empty + flag — the UI shows an error/empty
    // state instead of silently substituting synthetic data.
    return { records: [], provider: provider.name, usedFallback: true };
  }
}
