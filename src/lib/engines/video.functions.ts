import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  address: z.string().min(2),
  highlights: z.string().max(2000).optional(),
  style: z.enum(["luxury", "investor", "first_time_buyer", "rental"]).default("luxury"),
  length_seconds: z.number().int().min(15).max(120).default(45),
});

const Script = z.object({
  title: z.string(),
  hook: z.string(),
  scenes: z.array(z.object({
    seconds: z.number(),
    voiceover: z.string(),
    visual_direction: z.string(),
  })).min(3).max(8),
  cta: z.string(),
});

export const generateListingVideoScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const { experimental_output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      experimental_output: Output.object({ schema: Script }),
      system: `You are the PropAI Voice & Video Engine. Write a ${data.length_seconds}-second walkthrough script for a ${data.style} audience. Scene seconds should sum to approximately ${data.length_seconds}. Return JSON matching the schema exactly: an object with fields title (string), hook (string), scenes (array of 3-6 objects with seconds:number, voiceover:string, visual_direction:string), and cta (string).`,
      prompt: `Property: ${data.address}\nHighlights: ${data.highlights ?? "(none provided)"}\n\nProduce a structured script with 3-6 scenes.`,
    });
    return experimental_output;
  });

