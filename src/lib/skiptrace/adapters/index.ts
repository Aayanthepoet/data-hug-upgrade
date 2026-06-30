// Multi-provider skip-trace adapter registry.
//
// To add a new provider (IDI, TLO, REISkip, Whitepages, …):
//   1. Implement a class with `SkipTraceProvider` interface in
//      adapters/<provider>.server.ts.
//   2. Add a one-line factory below.
//   3. Add the provider id to the DB CHECK constraint in
//      user_skiptrace_credentials.
//
// Each adapter receives the user's own API key and maps its native
// response to the shared SkipTraceContact shape.

import type { SkipTraceProvider } from "../provider";
import { BatchDataProvider } from "./batchdata.server";

export type SkiptraceProviderId =
  | "batchdata"
  | "idi"
  | "tlo"
  | "reiskip"
  | "whitepages";

export const PROVIDER_LABELS: Record<SkiptraceProviderId, string> = {
  batchdata: "BatchData",
  idi: "IDI / LexisNexis",
  tlo: "TLOxp",
  reiskip: "REISkip",
  whitepages: "Whitepages Pro",
};

export const PROVIDER_AVAILABLE: Record<SkiptraceProviderId, boolean> = {
  batchdata: true,
  idi: false,
  tlo: false,
  reiskip: false,
  whitepages: false,
};

type Factory = (apiKey: string) => SkipTraceProvider;

const REGISTRY: Partial<Record<SkiptraceProviderId, Factory>> = {
  batchdata: (key) => new BatchDataProvider(key),
  // idi:        (key) => new IdiProvider(key),
  // tlo:        (key) => new TloProvider(key),
  // reiskip:    (key) => new ReiSkipProvider(key),
  // whitepages: (key) => new WhitepagesProvider(key),
};

export function buildAdapter(provider: SkiptraceProviderId, apiKey: string): SkipTraceProvider | null {
  const factory = REGISTRY[provider];
  return factory ? factory(apiKey) : null;
}
