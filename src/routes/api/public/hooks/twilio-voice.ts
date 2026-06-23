// Twilio Voice webhook — Twilio POSTs here when someone calls your number.
// Returns TwiML telling Twilio what to do with the call.
//
// Configure in Twilio Console → Phone Numbers → your number → Voice Configuration
// → "A call comes in" → Webhook → this URL (HTTP POST).

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/twilio-voice")({
  server: {
    handlers: {
      POST: async () => {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thanks for calling PropAI. Please leave a message after the tone.</Say>
  <Record maxLength="120" playBeep="true" />
  <Hangup/>
</Response>`;
        return new Response(twiml, {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      },
      GET: async () => new Response("Twilio voice webhook OK", { status: 200 }),
    },
  },
});
