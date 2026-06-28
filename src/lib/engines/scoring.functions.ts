import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Loose schema — coerce numbers, default missing arrays, normalize tier.
const TierSchema = z
  .string()
  .transform((s) => s.toLowerCase().replace(/[\s-]/g, "_"))
  .pipe(z.enum(["cold", "warm", "hot", "on_fire"]).catch("cold"));

const ScoreSchema = z.object({
  score: z.coerce.number().min(0).max(100).catch(0),
  tier: TierSchema.optional().default("cold"),
  rationale: z.string().max(800).optional().default(""),
  signals: z.array(z.string()).max(10).optional().default([]),
});

type ScoreResult = z.infer<typeof ScoreSchema>;

function tierFromScore(s: number): "cold" | "warm" | "hot" | "on_fire" {
  if (s >= 85) return "on_fire";
  if (s >= 65) return "hot";
  if (s >= 40) return "warm";
  return "cold";
}

function compactProperty(p: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function extractJSON(raw: string): unknown {
  let cleaned = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) cleaned = cleaned.slice(start, end + 1);
    else throw new Error("No JSON object found in model response");
  }
  return JSON.parse(cleaned);
}

const SYSTEM_PROMPT =
  "You are the PropAI Lead Scoring Engine for a real estate investor. Score a property's seller motivation 0-100 using ANY available signals: distress_type, equity, vacancy, absentee ownership, preforeclosure/auction status, tax owed, liens, days on market, location. Many properties have sparse data — score from whatever IS available; never refuse. Distress signals alone (e.g. hpd_litigation, vacate, tax_lien, preforeclosure, reo) justify a meaningful score even with no financial data. Tier: cold 0-39, warm 40-64, hot 65-84, on_fire 85-100.";

async function callModel(compact: Record<string, unknown>, strict: boolean): Promise<ScoreResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key);

  const userPrompt = strict
    ? `Property data (sparse fields omitted):\n${JSON.stringify(compact, null, 2)}\n\nReturn ONLY valid JSON, no markdown, no commentary, matching EXACTLY this shape:\n{"score": <number 0-100>, "tier": "cold"|"warm"|"hot"|"on_fire", "rationale": "<string under 400 chars>", "signals": ["<short signal>", ...]}\nIf data is sparse, score from distress_type and location alone.`
    : `Property data (sparse fields omitted):\n${JSON.stringify(compact, null, 2)}\n\nReturn a JSON object with: score (0-100), tier (cold/warm/hot/on_fire), rationale (short), signals (array of 2-6 short strings). Score from whatever is available — distress_type alone is enough.`;

  const { text } = await generateText({
    model: gateway("google/gemini-3-flash-preview"),
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  const parsed = extractJSON(text);
  const result = ScoreSchema.parse(parsed);
  // Re-align tier with score for consistency
  result.tier = tierFromScore(result.score);
  return result;
}

async function scoreOne(property: Record<string, unknown>): Promise<ScoreResult> {
  const compact = compactProperty(property);
  try {
    return await callModel(compact, false);
  } catch (e1) {
    try {
      return await callModel(compact, true);
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      throw new Error(`Scoring failed after retry: ${msg}`);
    }
  }
}

export const scoreProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ property_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: prop, error } = await supabase
      .from("properties").select("*").eq("id", data.property_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!prop) throw new Error("Property not found");

    const result = await scoreOne(prop as Record<string, unknown>);
    const notes = `Lead Score ${result.score} (${result.tier}): ${result.rationale}\nSignals: ${result.signals.join("; ")}`;
    const { error: upErr } = await supabase
      .from("properties")
      .update({ lead_score: Math.round(result.score), notes })
      .eq("id", data.property_id);
    if (upErr) throw new Error(upErr.message);
    return result;
  });

export const scoreAllUnscored = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ limit: z.number().int().min(1).max(25).default(10) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("properties")
      .select("*")
      .is("lead_score", null)
      .limit(data.limit);
    if (error) throw new Error(error.message);
    if (!rows?.length) return { scored: 0, failed: 0 };

    let scored = 0;
    let failed = 0;
    for (const prop of rows) {
      try {
        const result = await scoreOne(prop as Record<string, unknown>);
        const notes = `Lead Score ${result.score} (${result.tier}): ${result.rationale}\nSignals: ${result.signals.join("; ")}`;
        await supabase
          .from("properties")
          .update({ lead_score: Math.round(result.score), notes })
          .eq("id", (prop as { id: string }).id);
        scored++;
      } catch {
        failed++;
      }
    }
    return { scored, failed };
  });

export const listScoredProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("properties")
      .select("id, address, city, state, zip, distress_type, equity, estimated_value, lead_score, notes, auction_date")
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { properties: data ?? [] };
  });
