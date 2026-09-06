// Vision Studio image provider. SPLIT UPSTREAM as of the direct-provider move:
//
//   1. IMAGE-EDIT (true img2img) — STILL ON THE LOVABLE AI GATEWAY.
//      When the caller passes `sourceImageUrl`, we send the user's actual
//      photo to `google/gemini-3.1-flash-image` (Nano Banana 2) via the
//      gateway's chat-completions image shape. Gemini edits THEIR photo
//      in-place, preserving room geometry/windows/finishes.
//      ⚠️ THIS PATH DIES WHEN LOVABLE LAPSES. It cannot be repointed at
//      api.openai.com by swapping a URL: the body is a chat-completions
//      payload (`messages`/`modalities`/`image_url`) POSTed at an images
//      endpoint, which only the gateway accepts. A direct port means
//      multipart `POST /v1/images/edits`, and gpt-image edits are not a
//      like-for-like replacement for Gemini's geometry preservation.
//      Tracked as a separate job — do not "fix" this by URL swap.
//
//   2. TEXT-TO-IMAGE (fallback) — MOVED TO OPENAI DIRECT.
//      When no source photo is present we call
//      `https://api.openai.com/v1/images/generations` with `gpt-image-2`
//      using OPENAI_API_KEY. The body was already OpenAI-native, so this
//      was a URL, auth-header, and model-prefix change only.
//
// Both upstreams return the OpenAI images response shape, so
// `parseImageResponse` reads `data[0].b64_json` for either — but their
// quota signalling differs, so it takes an `upstream` discriminator.

import { RESOLUTION_SIZES, type VisionProvider, type VisionRenderInput, type VisionRenderResult } from "./provider";

const STYLE_DESCRIPTORS: Record<string, string> = {
  "modern": "clean lines, neutral palette, minimal decor, matte finishes",
  "scandinavian": "light woods, soft whites, cozy textiles, abundant natural light",
  "industrial": "exposed brick, raw steel, dark metals, Edison bulbs, concrete floors",
  "farmhouse": "shiplap, reclaimed wood beams, cream tones, vintage hardware",
  "mid-century": "walnut wood, tapered legs, mustard and teal accents, 1960s silhouettes",
  "coastal": "white-washed wood, soft blues and sandy neutrals, linen textiles, breezy natural light",
};

// Text-to-image: OpenAI direct. Image-edit: still the Lovable gateway.
const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const TEXT_TO_IMAGE_MODEL = "gpt-image-2";
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

type Upstream = "openai" | "lovable";

/**
 * Both upstreams return the OpenAI images success shape, but they signal a
 * spent balance differently:
 *
 *   - Lovable gateway: HTTP 402 for exhausted credits, 429 for rate limits.
 *   - OpenAI direct:   no 402 at all. Quota exhaustion arrives as a 429 whose
 *                      error body carries `"code": "insufficient_quota"` —
 *                      the same status as an ordinary rate limit. Only the
 *                      body separates "add billing" from "retry shortly", so
 *                      we inspect it rather than treating every 429 as
 *                      transient and telling the user to try again forever.
 */
async function parseImageResponse(
  res: Response,
  providerLabel: string,
  upstream: Upstream,
): Promise<string> {
  if (!res.ok) {
    const text = await res.text();
    if (upstream === "openai") {
      if (res.status === 429 && /insufficient_quota/i.test(text)) {
        throw new Error(
          "OpenAI quota exhausted. Add credit to the OpenAI account to keep rendering.",
        );
      }
      if (res.status === 429) throw new Error("Rate limited by OpenAI. Try again in a moment.");
      if (res.status === 401) throw new Error("OpenAI rejected OPENAI_API_KEY (401).");
    } else {
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits to keep rendering.");
      if (res.status === 429) throw new Error("Rate limited by AI gateway. Try again in a moment.");
    }
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

/**
 * The two render paths now sit on different upstreams and different keys, so
 * the provider takes both and validates each at render time — a deployment
 * holding only one key still gets the path that key can serve, instead of
 * failing every render up front.
 */
export interface VisionProviderKeys {
  /** Text-to-image (OpenAI direct). */
  openaiApiKey?: string;
  /** Image-edit (Lovable gateway, Gemini). */
  lovableApiKey?: string;
}

export function createLovableVisionProvider(keys: VisionProviderKeys): VisionProvider {
  return {
    // Surface the dynamic model in the name so audit rows show which path ran.
    name: "vision/auto",
    supportedResolutions: ["hd"] as const,
    async render(input: VisionRenderInput): Promise<VisionRenderResult> {
      const descriptor = STYLE_DESCRIPTORS[input.style] ?? input.style;

      // === Path 1: IMAGE-EDIT via Gemini (true img2img) — UNCHANGED, still
      // on the Lovable gateway. See the file header before touching this. ===
      if (input.sourceImageUrl) {
        if (!keys.lovableApiKey) {
          throw new Error(
            "Image edit needs LOVABLE_API_KEY (the Gemini img2img path is still on the Lovable gateway). Remove the source photo to render text-to-image instead.",
          );
        }
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

        const res = await fetch(LOVABLE_GATEWAY_URL, {
          method: "POST",
          headers: {
            "Lovable-API-Key": keys.lovableApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const b64 = await parseImageResponse(res, IMAGE_EDIT_MODEL, "lovable");
        return { provider: `lovable-ai/${IMAGE_EDIT_MODEL}`, imageBase64: b64 };
      }

      // === Path 2: TEXT-TO-IMAGE fallback — OpenAI direct ===
      if (!keys.openaiApiKey) {
        throw new Error("Text-to-image needs OPENAI_API_KEY.");
      }
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

      const res = await fetch(OPENAI_IMAGES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${keys.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const b64 = await parseImageResponse(res, TEXT_TO_IMAGE_MODEL, "openai");
      return { provider: `openai/${TEXT_TO_IMAGE_MODEL}`, imageBase64: b64 };
    },
  };
}
