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
