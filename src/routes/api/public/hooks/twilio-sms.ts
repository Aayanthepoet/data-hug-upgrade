// Twilio inbound SMS webhook. Twilio POSTs form-encoded data here when
// someone texts your Twilio number. We record it as an inbound outreach
// message and, if it matches a recent outbound to that number, mark the
// outbound as "replied".
//
// Configure in Twilio Console → Phone Numbers → your number → Messaging
// → "A message comes in" → Webhook → this URL (HTTP POST).

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/twilio-sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const from = String(form.get("From") ?? "");
        const to = String(form.get("To") ?? "");
        const body = String(form.get("Body") ?? "");
        const messageSid = String(form.get("MessageSid") ?? "");

        if (!from || !body) {
          return new Response("<Response/>", {
            status: 200,
            headers: { "Content-Type": "text/xml" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();

        // Match most recent outbound to this number and mark replied.
        const { data: outbound } = await supabaseAdmin
          .from("outreach_messages")
          .select("id")
          .eq("provider", "twilio")
          .eq("to_value", from)
          .eq("direction", "outbound")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (outbound) {
          await supabaseAdmin
            .from("outreach_messages")
            .update({ status: "replied", response: body, replied_at: now })
            .eq("id", outbound.id);
        }

        // Log the inbound message itself.
        await supabaseAdmin.from("outreach_messages").insert({
          channel: "sms",
          direction: "inbound",
          provider: "twilio",
          provider_message_id: messageSid || null,
          to_value: to,
          from_value: from,
          body,
          status: "delivered",
          received_at: now,
        });

        // Empty TwiML = no auto-reply.
        return new Response("<Response/>", {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
