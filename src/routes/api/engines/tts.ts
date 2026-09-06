// Text-to-speech via the OpenAI API directly (api.openai.com/v1/audio/speech).
//
// Moved off the Lovable AI gateway — the request body was already
// OpenAI-native, so this is a URL, auth-header, and model-prefix change
// only. Anthropic has no text-to-speech endpoint, which is why this
// doesn't live in src/lib/engines/anthropic.server.ts.
//
// Model: "gpt-4o-mini-tts" (was "openai/gpt-4o-mini-tts" behind the
//   gateway, which required the vendor prefix). Default voice "alloy".
//
import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/engines/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireApiAuth(request);
        if (auth instanceof Response) return auth;

        const key = process.env.OPENAI_API_KEY;
        if (!key) return new Response("Missing OPENAI_API_KEY", { status: 500 });

        // Cap request body to 32KB before parsing.
        const cl = Number(request.headers.get("content-length") ?? "0");
        if (cl > 32_000) return new Response("Payload too large", { status: 413 });

        let body: { input?: string; voice?: string };
        try {
          body = (await request.json()) as { input?: string; voice?: string };
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const input = body.input;
        const voice = body.voice ?? "alloy";
        if (!input || input.length < 2) return new Response("Input required", { status: 400 });

        const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o-mini-tts",
            input: input.slice(0, 4000),
            voice,
            response_format: "mp3",
          }),
        });
        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
