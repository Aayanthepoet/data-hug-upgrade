// BatchData skip-trace adapter.
//
// Docs: https://docs.batchdata.com/reference/skip-trace
// Endpoint: POST https://api.batchdata.com/api/v1/property/skip-trace
// Auth:     Authorization: Bearer <user-provided API key>
// Request body shape (one of many supported):
//   { requests: [ { propertyAddress: { street, city, state, zip },
//                   name: { first, last } } ] }
// Response shape (per match, under `results.persons[]`):
//   { name: { first, last },
//     phoneNumbers: [{ number, type, reachable, score }],
//     emails:       [{ email, score }],
//     addresses:    [{ street, city, state, zip, type }],
//     relatives:    [{ name: { first, last } }] }
//
// Billing: each call is billed by BatchData directly to the user's
// BatchData account using their key. PropAI does not proxy or surcharge.

import type {
  SkipTraceContact,
  SkipTraceInput,
  SkipTraceProvider,
  SkipTraceResult,
} from "../provider";

const BATCHDATA_ENDPOINT =
  "https://api.batchdata.com/api/v1/property/skip-trace";
const BATCHDATA_STATUS_ENDPOINT =
  "https://api.batchdata.com/api/v1/account/status";

function splitName(full: string): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/);
  const filtered = parts.filter((p) => !/^(LLC|INC|CORP|LP|LTD|TRUST)\b/i.test(p));
  return {
    first: filtered[0] ?? "",
    last: filtered.length > 1 ? filtered[filtered.length - 1] : "",
  };
}

export class BatchDataProvider implements SkipTraceProvider {
  readonly name = "batchdata";
  constructor(private readonly apiKey: string) {
    if (!apiKey) throw new Error("BatchData API key required");
  }

  /** Lightweight credential test. Hits the account status endpoint, which
   *  validates the key without consuming a skip-trace credit. */
  async testCredential(): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(BATCHDATA_STATUS_ENDPOINT, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      });
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: "Invalid BatchData API key" };
      }
      if (!res.ok) return { ok: false, error: `BatchData HTTP ${res.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Network error" };
    }
  }

  async trace(input: SkipTraceInput): Promise<SkipTraceResult> {
    const { first, last } = splitName(input.fullName);
    const body = {
      requests: [
        {
          propertyAddress: {
            street: input.mailingAddress ?? "",
            city: input.mailingCity ?? "",
            state: input.mailingState ?? "",
            zip: input.mailingZip ?? "",
          },
          name: { first, last },
        },
      ],
    };

    const res = await fetch(BATCHDATA_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`BatchData skip-trace failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const json: any = await res.json();
    const persons: any[] =
      json?.results?.persons ??
      json?.results?.[0]?.persons ??
      json?.persons ??
      [];

    const contacts: SkipTraceContact[] = [];

    for (const person of persons) {
      for (const p of person?.phoneNumbers ?? person?.phones ?? []) {
        const number = p?.number ?? p?.phone;
        if (!number) continue;
        contacts.push({
          contact_type: "phone",
          value: String(number),
          confidence: Number(p?.score ?? p?.confidence ?? 70),
          source: "batchdata",
          notes: [p?.type, p?.reachable ? "reachable" : null].filter(Boolean).join(" · ") || null,
        });
      }
      for (const e of person?.emails ?? []) {
        const email = e?.email ?? e?.address;
        if (!email) continue;
        contacts.push({
          contact_type: "email",
          value: String(email),
          confidence: Number(e?.score ?? e?.confidence ?? 60),
          source: "batchdata",
        });
      }
      for (const a of person?.addresses ?? []) {
        const street = a?.street ?? a?.line1;
        if (!street) continue;
        contacts.push({
          contact_type: "address",
          value: [street, a?.city, a?.state, a?.zip].filter(Boolean).join(", "),
          confidence: Number(a?.score ?? 60),
          source: "batchdata",
          notes: a?.type ?? null,
        });
      }
      for (const r of person?.relatives ?? []) {
        const n = r?.name ?? {};
        const name = [n?.first, n?.last].filter(Boolean).join(" ");
        if (!name) continue;
        contacts.push({
          contact_type: "relative",
          value: name,
          confidence: 50,
          source: "batchdata",
        });
      }
    }

    return { contacts, provider: this.name };
  }
}
