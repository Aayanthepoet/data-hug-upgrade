// Internal hook called by the database `dispatch_notification` function via
// pg_net when a user has SMS alerts enabled and is not in their quiet-hours
// window. Verifies a shared secret header, then sends an SMS via Twilio.
//
// Requires the following env vars to actually send:
//   NOTIFY_HOOK_SECRET   – shared secret verifying the caller
//   TWILIO_ACCOUNT_SID   – Twilio account SID (Console → Account Info)
//   TWILIO_API_KEY       – Twilio auth token / API key secret
//   TWILIO_PHONE_NUMBER  – the "From" number in E.164 format
//
// If any are missing the route logs and returns 200 so the DB trigger
// path doesn't keep retrying. The in-app notification was already written.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const PayloadSchema = z.object({
  user_id: z.string().uuid(),
  phone: z.string().min(7).max(20),
  title: z.string().max(200),
  body: z.string().max(500).optional().nullable(),
  type: z.string().max(50),
});

export const Route = createFileRoute("/api/public/hooks/notify-sms")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.NOTIFY_HOOK_SECRET;
        const provided = request.headers.get("x-notify-secret") ?? "";
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let payload: z.infer<typeof PayloadSchema>;
        try {
          payload = PayloadSchema.parse(await request.json());
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const apiKey = process.env.TWILIO_API_KEY;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;
        if (!accountSid || !apiKey || !fromNumber) {
          console.warn(
            "[notify-sms] SMS skipped: missing TWILIO_ACCOUNT_SID / TWILIO_API_KEY / TWILIO_PHONE_NUMBER",
          );
          return Response.json({ ok: true, sent: false, reason: "twilio_not_configured" });
        }

        const text = payload.body ? `${payload.title}\n${payload.body}` : payload.title;
        const form = new URLSearchParams({
          To: payload.phone,
          From: fromNumber,
          Body: text.slice(0, 320),
        });

        const auth = btoa(`${accountSid}:${apiKey}`);
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

        try {
          const resp = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          });
          if (!resp.ok) {
            const errText = await resp.text().catch(() => "");
            console.error("[notify-sms] Twilio error", resp.status, errText.slice(0, 300));
            return Response.json({ ok: false, sent: false, status: resp.status });
          }
          return Response.json({ ok: true, sent: true });
        } catch (e) {
          console.error("[notify-sms] fetch failed", e);
          return Response.json({ ok: false, sent: false, error: "fetch_failed" });
        }
      },
    },
  },
});
