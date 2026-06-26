// Lovable AI image-gen provider for Vision Studio.
//
// Two render paths, picked automatically:
//   1. IMAGE-EDIT (true img2img): when the caller passes `sourceImageUrl`,
//      we send the user's actual photo to `google/gemini-3.1-flash-image`
//      (Nano Banana 2) via the chat-completions image shape. Gemini edits
//      THEIR photo in-place, preserving room geometry/windows/finishes.
//   2. TEXT-TO-IMAGE (fallback): when no source photo is present, we keep
//      the existing `openai/gpt-image-2` prompt-only generation untouched.
//
// Both paths go through `https://ai.gateway.lovable.dev/v1/images/generations`
// using the existing `LOVABLE_API_KEY` — no separate GEMINI_API_KEY needed.
// The gateway normalizes Gemini's chat-style response to the OpenAI images
// shape, so we always read `data[0].b64_json` regardless of model.

import { RESOLUTION_SIZES, type VisionProvider, type VisionRenderInput, type VisionRenderResult } from "./provider";

const STYLE_DESCRIPTORS: Record<string, string> = {
  "modern": "clean lines, neutral palette, minimal decor, matte finishes",
  "scandinavian": "light woods, soft whites, cozy textiles, abundant natural light",
  "industrial": "exposed brick, raw steel, dark metals, Edison bulbs, concrete floors",
  "farmhouse": "shiplap, reclaimed wood beams, cream tones, vintage hardware",
  "mid-century": "walnut wood, tapered legs, mustard and teal accents, 1960s silhouettes",
  "coastal": "white-washed wood, soft blues and sandy neutrals, linen textiles, breezy natural light",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const TEXT_TO_IMAGE_MODEL = "openai/gpt-image-2";
const IMAGE_EDIT_MODEL = "google/gemini-3.1-flash-image";

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch source image (${res.status})`);
  const contentType = res.headers.get("content-type") ?? "image/png";
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  // Chunked to avoid call-stack limits on big photos.
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return `data:${contentType};base64,${btoa(bin)}`;
}

async function parseImageResponse(res: Response, providerLabel: string): Promise<string> {
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits to keep rendering.");
    if (res.status === 429) throw new Error("Rate limited by AI gateway. Try again in a moment.");
    throw new Error(`Vision provider error (${res.status}) [${providerLabel}]: ${text}`);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = json.data?.[0];
  if (item?.b64_json) return item.b64_json;
  if (item?.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error(`Failed to fetch generated image: ${imgRes.status}`);
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    return btoa(bin);
  }
  throw new Error("Provider returned no image data");
}

export function createLovableVisionProvider(apiKey: string): VisionProvider {
  return {
    // Surface the dynamic model in the name so audit rows show which path ran.
    name: "lovable-ai/auto",
    supportedResolutions: ["hd"] as const,
    async render(input: VisionRenderInput): Promise<VisionRenderResult> {
      const descriptor = STYLE_DESCRIPTORS[input.style] ?? input.style;

      // === Path 1: IMAGE-EDIT via Gemini (true img2img) ===
      if (input.sourceImageUrl) {
        const dataUrl = await fetchAsDataUrl(input.sourceImageUrl);
        const editPrompt =
          `Redesign THIS exact room in ${input.style} interior style ` +
          `(${descriptor}). Preserve the existing room geometry, window/door ` +
          `placement, ceiling height, and camera angle from the source photo. ` +
          `Only restyle finishes, furniture, lighting, and decor. ` +
          `Additional direction: ${input.prompt}`;

        const body = {
          model: IMAGE_EDIT_MODEL,
          modalities: ["image", "text"],
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: editPrompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        };

        const res = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            "Lovable-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const b64 = await parseImageResponse(res, IMAGE_EDIT_MODEL);
        return { provider: `lovable-ai/${IMAGE_EDIT_MODEL}`, imageBase64: b64 };
      }

      // === Path 2: TEXT-TO-IMAGE fallback (unchanged) ===
      const fullPrompt =
        `Photorealistic interior redesign of the described room in ${input.style} style (${descriptor}). ` +
        `Keep room geometry, ceiling height, and window placement realistic. ` +
        `${input.prompt}`;

      const body = {
        model: TEXT_TO_IMAGE_MODEL,
        prompt: fullPrompt,
        quality: "low",
        size: RESOLUTION_SIZES[input.resolution],
      };

      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          "Lovable-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const b64 = await parseImageResponse(res, TEXT_TO_IMAGE_MODEL);
      return { provider: `lovable-ai/${TEXT_TO_IMAGE_MODEL}`, imageBase64: b64 };
    },
  };
}
