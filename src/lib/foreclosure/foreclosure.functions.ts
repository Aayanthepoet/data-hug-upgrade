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

const CLAUDE_MODEL = "claude-sonnet-4-5";
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

export const skipTraceOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SkipInput.parse(d))
  .handler(async ({ data }) => {
    const system =
      "You are a NY public-records skip-trace assistant with web_search access. Search ACRIS, county clerk records, DOB filings, and public tax rolls to find verifiable owner-contact leads. Never fabricate specific phone numbers or emails. Mark every result as a suggestion with a confidence score (low/medium/high) and cite the public source.";
    const prompt = `Find up to 3 likely contact leads for the owner of this property. Use web search on ACRIS, NYC DOB, county tax rolls.

Return ONLY a JSON object (no prose): {"leads":[{"type":"","value":"","source":"","confidence":"","rationale":""}, ...]}

${JSON.stringify(data.property, null, 2)}`;
    try {
      const text = await callClaude({
        system,
        prompt,
        webSearch: true,
        maxTokens: 3072,
      });
      const parsed = extractJson(text) as { leads?: unknown };
      const result = z
        .object({
          leads: z.array(
            z.object({
              type: z.string(),
              value: z.string(),
              source: z.string(),
              confidence: z.string(),
              rationale: z.string(),
            }),
          ),
        })
        .safeParse(parsed);
      if (result.success) return { leads: result.data.leads };
      return { leads: [] };
    } catch (error) {
      console.error("[foreclosure.skiptrace]", error);
      return { leads: [] };
    }
  });
