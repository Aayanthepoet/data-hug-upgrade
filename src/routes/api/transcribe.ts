// Speech-to-text via the OpenAI API directly (api.openai.com/v1/audio/transcriptions).
//
// Moved off the Lovable AI gateway — the request shape was already
// OpenAI-native (multipart `model` + `file`), so this is a URL, key, and
// model-prefix change only. Anthropic has no speech-to-text endpoint,
// which is why this doesn't live in src/lib/engines/anthropic.server.ts.
//
// Model: "gpt-4o-mini-transcribe" (was "openai/gpt-4o-mini-transcribe"
//   behind the gateway, which required the vendor prefix).
//
import { createFileRoute } from "@tanstack/react-router";
import { requireApiAuth } from "@/lib/api-auth.server";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireApiAuth(request);
        if (auth instanceof Response) return auth;

        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) {
          return new Response("Missing OPENAI_API_KEY", { status: 500 });
        }

        const contentType = request.headers.get("content-type") ?? "";
        if (!contentType.includes("multipart/form-data")) {
          return new Response("Expected multipart/form-data", { status: 400 });
        }

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof Blob) || file.size === 0) {
          return new Response("Empty or missing audio file", { status: 400 });
        }
        if (file.size > 24 * 1024 * 1024) {
          return new Response("Audio too large (max 24MB)", { status: 413 });
        }

        const mime = (file.type || "").split(";")[0];
        const extMap: Record<string, string> = {
          "audio/webm": "webm",
          "audio/mp4": "mp4",
          "audio/mpeg": "mp3",
          "audio/wav": "wav",
          "audio/x-wav": "wav",
          "audio/ogg": "ogg",
        };
        const ext = extMap[mime] ?? "webm";

        const upstream = new FormData();
        upstream.append("model", "gpt-4o-mini-transcribe");
        upstream.append("file", file, `recording.${ext}`);

        const resp = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${openaiKey}` },
            body: upstream,
          },
        );

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          return new Response(text || `Transcription failed: ${resp.status}`, {
            status: resp.status,
          });
        }

        const json = (await resp.json()) as { text?: string };
        return Response.json({ text: json.text ?? "" });
      },
    },
  },
});
