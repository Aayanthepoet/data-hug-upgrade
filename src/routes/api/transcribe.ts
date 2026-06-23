import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
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
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", file, `recording.${ext}`);

        const resp = await fetch(
          "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${lovableKey}` },
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
