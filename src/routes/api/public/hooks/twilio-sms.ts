// Twilio inbound SMS webhook. Twilio POSTs form-encoded data here when
// someone texts your Twilio number. We record it as an inbound outreach
// message and, if it matches a recent outbound to that number, mark the
// outbound as "replied".
//
// Configure in Twilio Console → Phone Numbers → your number → Messaging
// → "A message comes in" → Webhook → this URL (HTTP POST).

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

function getTwilioWebhookUrl(request: Request): string {
  const envUrl = process.env.TWILIO_WEBHOOK_URL;
  if (envUrl) return envUrl;

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const path = new URL(request.url).pathname;
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}${path}`;
  }
  return request.url;
}

function buildSignaturePayload(url: string, form: FormData): string {
  const params = new URLSearchParams();
  form.forEach((value, key) => {
    params.append(key, String(value));
  });
  const sorted = Array.from(params.keys()).sort();
  return url + sorted.map((key) => `${key}${params.get(key)}`).join("");
}

function verifyTwilioSignature(request: Request, form: FormData, authToken: string): boolean {
  const signature = request.headers.get("X-Twilio-Signature") ?? request.headers.get("x-twilio-signature");
  if (!signature || !authToken) return false;

  const url = getTwilioWebhookUrl(request);
  const payload = buildSignaturePayload(url, form);
  const expected = createHmac("sha1", authToken).update(payload).digest("base64");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/hooks/twilio-sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const form = await request.formData();

        if (!authToken) {
          console.error("[twilio-sms] TWILIO_AUTH_TOKEN is not configured");
          return new Response("<Response/>", {
            status: 200,
            headers: { "Content-Type": "text/xml" },
          });
        }

        if (!verifyTwilioSignature(request, form, authToken)) {
          console.warn("[twilio-sms] Invalid signature");
          return new Response("Forbidden", { status: 403 });
        }

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
