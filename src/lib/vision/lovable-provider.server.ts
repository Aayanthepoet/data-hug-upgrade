// Lovable AI image-gen provider for Vision Studio. Calls the gateway, returns
// raw PNG bytes. Throws on any non-2xx so the server function can record a
// failed render row.

import type { VisionProvider, VisionRenderInput, VisionRenderResult } from "./provider";

export function createLovableVisionProvider(apiKey: string): VisionProvider {
  return {
    name: "lovable-ai/gpt-image-2",
    async render(input: VisionRenderInput): Promise<VisionRenderResult> {
      const STYLE_DESCRIPTORS: Record<string, string> = {
        "modern": "clean lines, neutral palette, minimal decor, matte finishes",
        "scandinavian": "light woods, soft whites, cozy textiles, abundant natural light",
        "industrial": "exposed brick, raw steel, dark metals, Edison bulbs, concrete floors",
        "farmhouse": "shiplap, reclaimed wood beams, cream tones, vintage hardware",
        "mid-century": "walnut wood, tapered legs, mustard and teal accents, 1960s silhouettes",
        "coastal": "white-washed wood, soft blues and sandy neutrals, linen textiles, breezy natural light",
      };
      const descriptor = STYLE_DESCRIPTORS[input.style] ?? input.style;
      const fullPrompt =
        `Photorealistic interior redesign of the described room in ${input.style} style (${descriptor}). ` +
        `Keep room geometry, ceiling height, and window placement realistic. ` +
        `${input.prompt}`;

      const body: Record<string, unknown> = {
        model: "openai/gpt-image-2",
        prompt: fullPrompt,
        quality: "low",
      };
      if (input.sourceImageUrl) {
        // gpt-image-2 accepts an input image via `image` for edits.
        body.image = input.sourceImageUrl;
      }

      const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          "Lovable-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        if (res.status === 402) throw new Error("AI credits exhausted. Add credits to keep rendering.");
        if (res.status === 429) throw new Error("Rate limited by AI gateway. Try again in a moment.");
        throw new Error(`Vision provider error (${res.status}): ${text}`);
      }
      const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
      const item = json.data?.[0];
      if (item?.b64_json) {
        return { provider: "lovable-ai/gpt-image-2", imageBase64: item.b64_json };
      }
      if (item?.url) {
        // Some upstream variants return a URL — fetch & re-encode so we always
        // persist bytes to storage rather than a third-party hotlink.
        const imgRes = await fetch(item.url);
        if (!imgRes.ok) throw new Error(`Failed to fetch generated image: ${imgRes.status}`);
        const buf = new Uint8Array(await imgRes.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        return { provider: "lovable-ai/gpt-image-2", imageBase64: btoa(bin) };
      }
      throw new Error("Provider returned no image data");
    },
  };
}
