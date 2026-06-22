// Provider-agnostic skip-trace interface. Swap MockSkipTraceProvider for
// BatchSkipTracing / IDI / TLO later without changing the server function
// or any UI code.

export type SkipTraceContactType = "phone" | "email" | "relative" | "address";

export interface SkipTraceContact {
  contact_type: SkipTraceContactType;
  value: string;
  confidence: number; // 0–100
  source: string;
  notes?: string | null;
}

export interface SkipTraceInput {
  fullName: string;
  mailingAddress?: string | null;
  mailingCity?: string | null;
  mailingState?: string | null;
  mailingZip?: string | null;
}

export interface SkipTraceResult {
  contacts: SkipTraceContact[];
  provider: string;
}

export interface SkipTraceProvider {
  readonly name: string;
  trace(input: SkipTraceInput): Promise<SkipTraceResult>;
}
