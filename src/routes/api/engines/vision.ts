import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/engines/vision")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const { prompt, style = "modern" } = (await request.json()) as { prompt: string; style?: string };
        if (!prompt || prompt.length < 4) return new Response("Prompt required", { status: 400 });

        const fullPrompt = `Photorealistic interior redesign of the described room in ${style} style. Keep room geometry and windows. ${prompt}`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-image-2",
            prompt: fullPrompt,
            quality: "low",
          }),
        });
        if (!upstream.ok) {
          return new Response(await upstream.text(), { status: upstream.status });
        }
        const json = await upstream.json() as { data?: Array<{ b64_json?: string; url?: string }> };
        const item = json.data?.[0];
        const dataUrl = item?.b64_json
          ? `data:image/png;base64,${item.b64_json}`
          : item?.url ?? null;
        return Response.json({ image: dataUrl });
      },
    },
  },
});
