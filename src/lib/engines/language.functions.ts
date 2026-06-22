import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  task: z.enum(["outreach_letter", "outreach_sms", "outreach_email", "listing_description", "cma_summary", "negotiation_reply"]),
  context: z.string().min(2).max(8000),
  tone: z.enum(["warm", "professional", "casual", "urgent"]).default("warm"),
  variations: z.number().int().min(1).max(5).default(3),
});

export const composeWithLanguageEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const taskPrompts: Record<typeof data.task, string> = {
      outreach_letter: "Write personal seller outreach letters (one per variation, separated by '---').",
      outreach_sms: "Write SMS outreach messages, each under 160 characters (separated by '---').",
      outreach_email: "Write outreach emails with a subject line and body (separated by '---').",
      listing_description: "Write listing descriptions in a confident, emotional voice (separated by '---').",
      cma_summary: "Write a CMA (comparative market analysis) summary in 2-3 short paragraphs (separated by '---').",
      negotiation_reply: "Write polite but firm negotiation replies that protect the buyer's position (separated by '---').",
    };

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system: `You are the PropAI Language Engine for a real estate investor. Tone: ${data.tone}. Never invent owner names or facts not present in the context. Produce exactly ${data.variations} variation(s), separated by a line containing only '---'.`,
      prompt: `Task: ${taskPrompts[data.task]}\n\nContext:\n${data.context}`,
    });

    const variations = text.split(/^---\s*$/m).map((v) => v.trim()).filter(Boolean);
    return { variations };
  });
