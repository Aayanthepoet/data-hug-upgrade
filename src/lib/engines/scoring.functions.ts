import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ScoreSchema = z.object({
  score: z.number().min(0).max(100),
  tier: z.enum(["cold", "warm", "hot", "on_fire"]),
  rationale: z.string().max(400),
  signals: z.array(z.string()).max(6),
});

async function scoreOne(property: Record<string, unknown>) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key);
  const { output } = await generateText({
    model: gateway("google/gemini-3-flash-preview"),
    output: Output.object({ schema: ScoreSchema }),
    system:
      "You are the PropAI Lead Scoring Engine for a real estate investor. Score a property's seller motivation 0–100 using equity, distress type, vacancy, absentee ownership, preforeclosure status, tax owed, liens, days on market, and auction date proximity. Higher = more motivated to sell at a discount. Tier: cold 0–39, warm 40–64, hot 65–84, on_fire 85–100.",
    prompt: `Property:\n${JSON.stringify(property, null, 2)}\n\nReturn an honest score with 3–6 key signals.`,
  });
  return output;
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
    if (!rows?.length) return { scored: 0 };

    let scored = 0;
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
        // continue
      }
    }
    return { scored };
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
