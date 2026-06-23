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

        // Detect STOP / opt-out keywords (carrier-standard).
        const normalized = body.trim().toUpperCase();
        const stopKeywords = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
        const startKeywords = ["START", "UNSTOP", "YES"];
        const matchedStop = stopKeywords.find((k) => normalized === k || normalized.startsWith(k + " "));
        const matchedStart = startKeywords.find((k) => normalized === k);

        if (matchedStop) {
          await supabaseAdmin
            .from("sms_opt_outs")
            .upsert(
              { phone: from, keyword: matchedStop, source: "inbound_sms", reason: body },
              { onConflict: "phone", ignoreDuplicates: false },
            );
        } else if (matchedStart) {
          await supabaseAdmin
            .from("sms_opt_outs")
            .update({ restored_at: now, notes: `Restored via inbound "${matchedStart}"` })
            .eq("phone", from)
            .is("restored_at", null);
        }

        // Match most recent outbound to this number and mark replied.
        const { data: outbound } = await supabaseAdmin
          .from("outreach_messages")
          .select("id, user_id, owner_id, contact_id, campaign_id")
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

          // Log the inbound as its own row, linked to the same owner/campaign.
          await supabaseAdmin.from("outreach_messages").insert({
            user_id: outbound.user_id,
            owner_id: outbound.owner_id,
            contact_id: outbound.contact_id,
            campaign_id: outbound.campaign_id,
            channel: "sms",
            direction: "inbound",
            provider: "twilio",
            provider_message_id: messageSid || null,
            to_value: from,
            body,
            status: "delivered",
            sent_at: now,
          });
        }

        // Empty TwiML = no auto-reply.
        return new Response("<Response/>", {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
