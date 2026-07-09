import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PropertyTypeEnum = z.enum([
  "Pre-Foreclosure",
  "Auction",
  "Bank REO",
  "Short Sale",
]);

const PropertySchema = z.object({
  address: z.string(),
  city: z.string(),
  neighborhood: z.string(),
  type: z.string(),
  price: z.string(),
  beds: z.string(),
  baths: z.string(),
  sqft: z.string(),
  auctionDate: z.string(),
  indexNo: z.string(),
  lender: z.string(),
  owner: z.string(),
  ownerPhone: z.string(),
  ownerEmail: z.string(),
  ownerAddress: z.string(),
  contactSource: z.string(),
  notes: z.string(),
});

export type ForeclosureProperty = z.infer<typeof PropertySchema>;

const SearchInput = z.object({
  county: z.string().min(1).max(120),
  type: z.string().min(1).max(60),
});

const CLAUDE_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: string; [k: string]: unknown };

type AnthropicResponse = {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
};

function getAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing ANTHROPIC_API_KEY");
  return key;
}

async function callClaude(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
  webSearch?: boolean;
}): Promise<string> {
  const body: Record<string, unknown> = {
    model: CLAUDE_MODEL,
    max_tokens: params.maxTokens ?? 4096,
    system: params.system,
    messages: [{ role: "user", content: params.prompt }],
  };
  if (params.webSearch) {
    body.tools = [
      { type: "web_search_20250305", name: "web_search", max_uses: 8 },
    ];
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": getAnthropicKey(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 500)}`);
  }

  const json = (await res.json()) as AnthropicResponse;
  if (json.error) throw new Error(json.error.message ?? "Anthropic error");
  const text = (json.content ?? [])
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found");
  return JSON.parse(candidate.slice(start, end + 1));
}

export const searchForeclosureProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data }) => {
    const typeClause =
      data.type === "All" ? "any distress type" : `only "${data.type}" listings`;

    const system =
      "You are a NY foreclosure research agent with web_search access. Use the web_search tool to pull CURRENT, real listings from NYC Courts eCourts, PropertyShark, Zillow foreclosure listings, RealtyTrac, Foreclosure.com, and county clerk records. NEVER fabricate addresses, index numbers, phone numbers, or emails. If a field is not verifiable from your searches, return an empty string for that field. Prefer confirmed public-record data over inference.";

    const prompt = `Search the web NOW for active distressed properties in ${data.county}, filter: ${typeClause}. Perform multiple targeted searches (courts, PropertyShark, Zillow foreclosures, RealtyTrac). Compile 8-12 real properties.

Return ONLY a JSON object (no prose, no markdown fences) with shape:
{"properties":[{...}, ...]}

Each property MUST have these string fields (empty string if unknown): address, city, neighborhood, type (one of "Pre-Foreclosure","Auction","Bank REO","Short Sale"), price, beds, baths, sqft, auctionDate, indexNo, lender, owner, ownerPhone, ownerEmail, ownerAddress, contactSource, notes.`;

    try {
      const text = await callClaude({
        system,
        prompt,
        webSearch: true,
        maxTokens: 8192,
      });
      const parsed = extractJson(text) as { properties?: unknown };
      const result = z
        .object({ properties: z.array(PropertySchema) })
        .safeParse(parsed);
      if (result.success) return { properties: result.data.properties };
      return { properties: [] as ForeclosureProperty[] };
    } catch (error) {
      console.error("[foreclosure.search]", error);
      return {
        properties: [] as ForeclosureProperty[],
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  });

const LetterInput = z.object({ property: PropertySchema });

export const generateOutreachLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LetterInput.parse(d))
  .handler(async ({ data }) => {
    const text = await callClaude({
      system:
        "You are Aayan Spencer, a NY-based real estate investor. Write warm, respectful, direct outreach letters to distressed-property owners. Never overpromise. Sign as: Aayan Spencer, 347-383-6660.",
      prompt: `Write a single ~180-word outreach letter to the owner of this distressed property. Reference the situation gently and offer a no-obligation conversation. End with the signature line "Aayan Spencer — 347-383-6660". Return only the letter text.\n\nProperty:\n${JSON.stringify(data.property, null, 2)}`,
      maxTokens: 1024,
    });
    return { letter: text };
  });

export const analyzeInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LetterInput.parse(d))
  .handler(async ({ data }) => {
    const text = await callClaude({
      system:
        "You are a NY real estate investment analyst with web_search access. Use web search to pull current comps and neighborhood data before analyzing. Produce a concise investment analysis: estimated ARV range, likely repair cost range, MAO (70% rule), exit strategies (wholesale, flip, BRRRR), and key risks. Be explicit that figures are estimates.",
      prompt: `Analyze this property. Keep the response under 350 words, use short section headers.\n\n${JSON.stringify(data.property, null, 2)}`,
      webSearch: true,
      maxTokens: 2048,
    });
    return { analysis: text };
  });

const SkipInput = z.object({ property: PropertySchema });

const PortalSchema = z.object({
  portal_name: z.string().min(1),
  url: z.string().min(1),
  is_free: z.boolean().optional().default(false),
  what_it_yields: z.string().optional().default(""),
  steps: z.array(z.string()).optional().default([]),
  description: z.string().optional().default(""),
});

export type SkipTracePortal = z.infer<typeof PortalSchema>;

export const skipTraceOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SkipInput.parse(d))
  .handler(async ({ data }) => {
    const system = `You are a NY public-records research assistant. Given a distressed property, return the best free, publicly-accessible county/state portals a researcher should use to find the mortgagor, lender, index number, and other filing details.

CRITICAL OUTPUT RULES:
- Respond with ONLY a single valid JSON object. No markdown code fences. No preamble. No trailing prose.
- Shape: {"portals":[{"portal_name":string,"url":string,"is_free":boolean,"what_it_yields":string,"steps":string[],"description":string}, ...]}
- Every portal MUST include a non-empty portal_name and a fully-qualified https URL.
- steps is an ordered array of short imperative strings (e.g. "Select document type: Lis Pendens").
- Prefer official county clerk / court / ACRIS-style systems over aggregators. Include 2-5 portals.
- Never fabricate URLs — only include portals you are confident exist.`;

    const prompt = `Property:\n${JSON.stringify(data.property, null, 2)}\n\nReturn the JSON object described in the system prompt.`;

    let rawText = "";
    try {
      rawText = await callClaude({
        system,
        prompt,
        webSearch: true,
        maxTokens: 3072,
      });
    } catch (error) {
      console.error("[foreclosure.skiptrace] call failed", error);
      return {
        portals: [] as SkipTracePortal[],
        raw: "",
        formattingFailed: true as const,
        error: error instanceof Error ? error.message : "Skip trace failed",
      };
    }

    try {
      const stripped = rawText
        .replace(/^\s*```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      const start = stripped.indexOf("{");
      const end = stripped.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("No JSON object found");
      const parsed = JSON.parse(stripped.slice(start, end + 1));
      const result = z.object({ portals: z.array(PortalSchema).min(1) }).safeParse(parsed);
      if (!result.success) throw new Error("Portals array missing or invalid");
      return {
        portals: result.data.portals,
        raw: rawText,
        formattingFailed: false as const,
      };
    } catch (error) {
      console.error("[foreclosure.skiptrace] parse failed", error);
      return {
        portals: [] as SkipTracePortal[],
        raw: rawText,
        formattingFailed: true as const,
      };
    }
  });

// ============================================================
// Preliminary Title Search (NY)
// ============================================================

const TitleSearchInput = z.object({
  address: z.string().min(3).max(300),
});

const MortgageSchema = z.object({
  lender: z.string().default(""),
  amount: z.string().default(""),
  date: z.string().default(""),
});
const TaxLienSchema = z.object({
  amount: z.string().default(""),
  year: z.string().default(""),
  status: z.string().default(""),
});
const JudgmentSchema = z.object({
  creditor: z.string().default(""),
  amount: z.string().default(""),
  date: z.string().default(""),
});
const LisPendensSchema = z.object({
  caseNo: z.string().default(""),
  plaintiff: z.string().default(""),
  filedDate: z.string().default(""),
  status: z.string().default(""),
});
const MechanicsLienSchema = z.object({
  claimant: z.string().default(""),
  amount: z.string().default(""),
  date: z.string().default(""),
});
const HpdViolationSchema = z.object({
  class: z.string().default(""),
  description: z.string().default(""),
  date: z.string().default(""),
  status: z.string().default(""),
});

export const TitleSearchResultSchema = z.object({
  address: z.string().default(""),
  searchDate: z.string().default(""),
  ownerOfRecord: z.string().nullable().default(null),
  ownerSince: z.string().nullable().default(null),
  deedType: z.string().nullable().default(null),
  purchasePrice: z.string().nullable().default(null),
  legalDescription: z.string().nullable().default(null),
  openMortgages: z.array(MortgageSchema).default([]),
  taxLiens: z.array(TaxLienSchema).default([]),
  judgments: z.array(JudgmentSchema).default([]),
  lisPendens: z.array(LisPendensSchema).default([]),
  mechanicsLiens: z.array(MechanicsLienSchema).default([]),
  hpdViolations: z.array(HpdViolationSchema).default([]),
  taxStatus: z.string().nullable().default(null),
  taxDelinquencyAmount: z.string().nullable().default(null),
  marketableTitle: z.string().default("Unknown"),
  redFlags: z.array(z.string()).default([]),
  recommendation: z.string().default(""),
});

export type TitleSearchResult = z.infer<typeof TitleSearchResultSchema>;

const TITLE_SEARCH_LIMIT_FREE = 10;

async function checkTitleSearchQuota(supabase: SupabaseLike, userId: string): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return { allowed: true, used: 0, limit: null };

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  const active = sub && ["active", "trialing"].includes(sub.status);
  if (active) return { allowed: true, used: 0, limit: null };

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("title_searches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  const used = count ?? 0;
  return { allowed: used < TITLE_SEARCH_LIMIT_FREE, used, limit: TITLE_SEARCH_LIMIT_FREE };
}

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
  from: (t: string) => any;
};

export const getTitleSearchQuota = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return checkTitleSearchQuota(context.supabase as unknown as SupabaseLike, context.userId);
  });

export const runTitleSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TitleSearchInput.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const quota = await checkTitleSearchQuota(supabase, context.userId);
    if (!quota.allowed) {
      return {
        ok: false as const,
        error: `Monthly limit reached (${quota.used}/${quota.limit}). Upgrade to Pro or Agency for unlimited title searches.`,
        quota,
      };
    }

    const system = `You are a New York real estate title search agent. For the property address provided search public records and return ONLY this JSON with no markdown or backticks:
{
"address": "full address searched",
"searchDate": "today's date",
"ownerOfRecord": "current owner name or null",
"ownerSince": "date of last deed transfer or null",
"deedType": "type of deed or null",
"purchasePrice": "last sale price or null",
"legalDescription": "lot and block or null",
"openMortgages": [{"lender": "name", "amount": "$000,000", "date": "recorded date"}],
"taxLiens": [{"amount": "$000", "year": "2024", "status": "open or paid"}],
"judgments": [{"creditor": "name", "amount": "$000,000", "date": "filed date"}],
"lisPendens": [{"caseNo": "index number", "plaintiff": "name", "filedDate": "date", "status": "active or cancelled"}],
"mechanicsLiens": [{"claimant": "name", "amount": "$000,000", "date": "filed date"}],
"hpdViolations": [{"class": "A/B/C", "description": "violation", "date": "issued date", "status": "open or closed"}],
"taxStatus": "current or delinquent",
"taxDelinquencyAmount": "$000 or null",
"marketableTitle": "Yes / No / Unknown",
"redFlags": ["list of any issues that would concern a buyer or investor"],
"recommendation": "1-2 sentence summary of title risk level"
}

Search these sources: ACRIS (acris.nyc.gov), NYSCEF court records, NYC Finance property tax records, NYC HPD violation records, NYS court judgment records, county clerk deed records. Never fabricate data — if a field is not verifiable, use null or an empty array.`;

    const prompt = `Property address: ${data.address}\n\nRun the title search and return ONLY the JSON object described.`;

    try {
      const raw = await callClaude({
        system,
        prompt,
        webSearch: true,
        maxTokens: 6144,
      });
      const parsed = extractJson(raw);
      const result = TitleSearchResultSchema.parse(parsed);
      if (!result.address) result.address = data.address;
      if (!result.searchDate) result.searchDate = new Date().toISOString().slice(0, 10);

      const { data: inserted, error } = await supabase
        .from("title_searches")
        .insert({ user_id: context.userId, address: data.address, results: result })
        .select("id, created_at")
        .single();
      if (error) throw error;

      return {
        ok: true as const,
        id: inserted.id as string,
        createdAt: inserted.created_at as string,
        result,
      };
    } catch (error) {
      console.error("[foreclosure.titleSearch]", error);
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Title search failed",
        quota,
      };
    }
  });

export const listTitleSearches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const { data, error } = await supabase
      .from("title_searches")
      .select("id, address, results, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { items: (data ?? []) as Array<{ id: string; address: string; results: TitleSearchResult; created_at: string }> };
  });

const GetTitleInput = z.object({ id: z.string().uuid() });
export const getTitleSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GetTitleInput.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as unknown as SupabaseLike;
    const { data: row, error } = await supabase
      .from("title_searches")
      .select("id, address, results, created_at")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Not found");
    return row as { id: string; address: string; results: TitleSearchResult; created_at: string };
  });
