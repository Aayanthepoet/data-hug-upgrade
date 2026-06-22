// Public webhook for inbound outreach replies (SMS/email/mail providers
// POST here when a recipient responds). Matches the original outbound row
// by (provider, provider_message_id) and flips status to "replied".
//
// Verifies HMAC-SHA256 over the raw body using OUTREACH_WEBHOOK_SECRET.
// External callers MUST send X-Outreach-Signature: sha256=<hex>.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const Payload = z.object({
  provider: z.string().min(1),
  provider_message_id: z.string().min(1),
  response: z.string().min(1).max(8000),
  // Optional: a fallback recipient identifier some providers send instead of
  // a stable message id (e.g. Twilio sends From/To, not the outbound SID).
  from: z.string().optional(),
});

function verify(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/hooks/outreach-reply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.OUTREACH_WEBHOOK_SECRET;
        if (!secret) {
          return new Response("Webhook secret not configured", { status: 503 });
        }

        const raw = await request.text();
        if (!verify(raw, request.headers.get("x-outreach-signature"), secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let parsed;
        try {
          parsed = Payload.parse(JSON.parse(raw));
        } catch {
          return new Response("Bad payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Match by stable (provider, provider_message_id). Falls back to
        // the most recent outbound message to `from` when the provider
        // doesn't return the original ID.
        let { data: row } = await supabaseAdmin
          .from("outreach_messages")
          .select("id")
          .eq("provider", parsed.provider)
          .eq("provider_message_id", parsed.provider_message_id)
          .maybeSingle();

        if (!row && parsed.from) {
          const { data: fallback } = await supabaseAdmin
            .from("outreach_messages")
            .select("id")
            .eq("provider", parsed.provider)
            .eq("to_value", parsed.from)
            .eq("direction", "outbound")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          row = fallback ?? null;
        }

        if (!row) return new Response("Message not found", { status: 404 });

        const now = new Date().toISOString();
        const { error } = await supabaseAdmin
          .from("outreach_messages")
          .update({ status: "replied", response: parsed.response, replied_at: now })
          .eq("id", row.id);
        if (error) return new Response(error.message, { status: 500 });

        return Response.json({ ok: true, id: row.id });
      },
    },
  },
});
