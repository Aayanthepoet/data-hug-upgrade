import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveSubscription } from "@/lib/billing/require-subscription.server";

const Input = z.object({ owner_id: z.string().uuid() });

const ContactSchema = z.object({
  contacts: z.array(z.object({
    contact_type: z.enum(["phone", "email", "linkedin", "facebook"]),
    value: z.string(),
    confidence: z.number().min(0).max(100),
    rationale: z.string(),
  })).max(8),
});

export const resolveOwnerContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: owner, error } = await supabase
      .from("owners").select("*").eq("id", data.owner_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!owner) throw new Error("Owner not found");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({ schema: ContactSchema }),
      system: "You are the PropAI Contact Resolver. Given an owner record, propose realistic skip-trace candidates (phone/email/social handles) that would be plausible to investigate. Mark confidence honestly; these are AI-generated leads pending verification, not verified contacts.",
      prompt: `Owner: ${JSON.stringify(owner, null, 2)}\n\nReturn up to 6 plausible contact candidates ordered by confidence.`,
    });

    // Persist to contacts table for the owner
    const rows = output.contacts.map((c) => ({
      owner_id: data.owner_id,
      contact_type: c.contact_type,
      value: c.value,
      confidence: Math.round(c.confidence),
      user_id: context.userId,
      notes: `AI Contact Resolver: ${c.rationale}`,
    }));
    if (rows.length) {
      await supabase.from("contacts").insert(rows as never);
    }

    return { resolved: output.contacts.length, contacts: output.contacts };
  });
