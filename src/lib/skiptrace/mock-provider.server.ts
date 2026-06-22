// Deterministic mock skip-trace provider. Generates realistic-looking
// phones, emails, and relatives so the outreach + AI-call flows work
// end-to-end before BatchSkipTracing is wired in.
//
// Same hash-based pattern as src/lib/distress/mock-provider.server.ts so
// the same owner always returns the same trace.

import type {
  SkipTraceContact,
  SkipTraceInput,
  SkipTraceProvider,
  SkipTraceResult,
} from "./provider";

const FIRST_NAMES = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Barbara"];
const LAST_RELATIONSHIPS = ["spouse", "sibling", "parent", "child", "cousin"];
const EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "aol.com"];
const AREA_CODES_BY_STATE: Record<string, string[]> = {
  NY: ["212", "718", "917", "646", "347"],
  NJ: ["201", "732", "973", "908"],
  PA: ["215", "267", "412", "484"],
  CT: ["203", "860"],
  CA: ["213", "415", "510", "619"],
  TX: ["214", "281", "512", "713"],
  FL: ["305", "407", "813", "954"],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function firstLastFromName(full: string): { first: string; last: string } {
  const parts = full.replace(/[^a-zA-Z\s&,-]/g, "").trim().split(/\s+/);
  // Skip entity suffixes like LLC, INC
  const filtered = parts.filter((p) => !/^(LLC|INC|CORP|LP|LTD|TRUST)\b/i.test(p));
  const first = filtered[0] ?? "Owner";
  const last = filtered[filtered.length - 1] ?? "Doe";
  return { first, last };
}

function makePhone(seed: number, state: string | null | undefined): string {
  const areaPool = AREA_CODES_BY_STATE[state ?? ""] ?? ["555"];
  const area = pick(areaPool, seed);
  const mid = String(200 + ((seed >> 4) % 799)).padStart(3, "0");
  const last = String((seed >> 7) % 10000).padStart(4, "0");
  return `(${area}) ${mid}-${last}`;
}

function makeEmail(first: string, last: string, seed: number): string {
  const domain = pick(EMAIL_DOMAINS, seed >> 3);
  const styles = [
    `${first}.${last}`,
    `${first}${last}`,
    `${first[0]}${last}`,
    `${first}${last}${(seed % 99)}`,
  ];
  return `${pick(styles, seed).toLowerCase()}@${domain}`;
}

export class MockSkipTraceProvider implements SkipTraceProvider {
  readonly name = "mock";

  async trace(input: SkipTraceInput): Promise<SkipTraceResult> {
    const { first, last } = firstLastFromName(input.fullName || "Owner");
    const baseSeed = hash(`${input.fullName}|${input.mailingAddress ?? ""}|${input.mailingZip ?? ""}`);

    const contacts: SkipTraceContact[] = [];

    // 2 phones, decreasing confidence.
    for (let i = 0; i < 2; i++) {
      const s = baseSeed + i * 17;
      contacts.push({
        contact_type: "phone",
        value: makePhone(s, input.mailingState ?? null),
        confidence: 90 - i * 18,
        source: "mock:public-records",
        notes: i === 0 ? "Primary mobile" : "Secondary landline",
      });
    }

    // 2 emails.
    for (let i = 0; i < 2; i++) {
      const s = baseSeed + 101 + i * 23;
      contacts.push({
        contact_type: "email",
        value: makeEmail(first, last, s),
        confidence: 75 - i * 20,
        source: "mock:email-append",
      });
    }

    // 2 relatives (just names — relationships).
    for (let i = 0; i < 2; i++) {
      const s = baseSeed + 211 + i * 29;
      const relFirst = pick(FIRST_NAMES, s);
      const relationship = pick(LAST_RELATIONSHIPS, s >> 5);
      contacts.push({
        contact_type: "relative",
        value: `${relFirst} ${last}`,
        confidence: 60 - i * 10,
        source: "mock:relatives",
        notes: relationship,
      });
    }

    // Sometimes a current mailing address override.
    if (baseSeed % 3 === 0 && input.mailingAddress) {
      contacts.push({
        contact_type: "address",
        value: `${input.mailingAddress}, ${input.mailingCity ?? ""} ${input.mailingState ?? ""} ${input.mailingZip ?? ""}`.trim(),
        confidence: 85,
        source: "mock:public-records",
        notes: "Most recent mailing address on file",
      });
    }

    return { contacts, provider: this.name };
  }
}

export function getSkipTraceProvider(): SkipTraceProvider {
  // Future: if (process.env.SKIPTRACE_PROVIDER === "batchdata") return new BatchDataProvider(...);
  return new MockSkipTraceProvider();
}
