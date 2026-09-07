// Vision Studio image provider. Both paths are now direct upstreams — the
// Lovable AI gateway is gone:
//
//   1. IMAGE-EDIT (true img2img) — GEMINI DIRECT.
//      When the caller passes `sourceImageUrl` we send the user's actual photo
//      to `gemini-3.1-flash-image` (Nano Banana 2) at the Generative Language
//      API. Gemini edits THEIR photo in place, preserving room geometry,
//      window/door placement and camera angle — verified against real listing
//      photos, interior and exterior, before this port landed.
//
//      Call shape is probed, not guessed:
//        - `v1` and `v1beta` behave identically here; we use `v1`.
//        - `generationConfig.responseModalities` is NOT required. The image
//          models default to image output, so we omit it.
//        - The request takes snake_case (`inline_data`/`mime_type`) but the
//          response comes back camelCase (`inlineData`/`mimeType`). That
//          asymmetry is the API's, not a typo.
//        - A successful edit returns a SINGLE image-only part. There is no
//          text part alongside it, so never index `parts[0].text` or assume a
//          [text, image] pair — scan for the first `inlineData`.
//        - Output is JPEG even when the source is PNG, and caps around 1MP
//          (a 12MP source came back 896x1195). Hence `mimeType` on the result:
//          the stored object must not be labelled .png.
//
//   2. TEXT-TO-IMAGE (fallback) — OPENAI DIRECT.
//      When no source photo is present we call
//      `https://api.openai.com/v1/images/generations` with `gpt-image-2`
//      using OPENAI_API_KEY.
//
// The two upstreams no longer share a response shape, so each has its own
// parser rather than one function with an `upstream` discriminator.

import { RESOLUTION_SIZES, type VisionProvider, type VisionRenderInput, type VisionRenderResult } from "./provider";

const STYLE_DESCRIPTORS: Record<string, string> = {
  "modern": "clean lines, neutral palette, minimal decor, matte finishes",
  "scandinavian": "light woods, soft whites, cozy textiles, abundant natural light",
  "industrial": "exposed brick, raw steel, dark metals, Edison bulbs, concrete floors",
  "farmhouse": "shiplap, reclaimed wood beams, cream tones, vintage hardware",
  "mid-century": "walnut wood, tapered legs, mustard and teal accents, 1960s silhouettes",
  "coastal": "white-washed wood, soft blues and sandy neutrals, linen textiles, breezy natural light",
};

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1";
const TEXT_TO_IMAGE_MODEL = "gpt-image-2";
const IMAGE_EDIT_MODEL = "gemini-3.1-flash-image";

/** Base64 image bytes plus the mime type they actually are. */
interface InlineImage {
  mimeType: string;
  data: string;
}

async function fetchSourceImage(url: string): Promise<InlineImage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch source image (${res.status})`);
  // Strip any `; charset=` suffix — Gemini wants a bare image/* mime type.
  const mimeType = (res.headers.get("content-type") ?? "image/png").split(";")[0]!.trim();
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  // Chunked to avoid call-stack limits on big photos.
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return { mimeType, data: btoa(bin) };
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

async function parseGeminiResponse(res: Response, providerLabel: string): Promise<InlineImage> {
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) {
      // Gemini image models have no free tier at all. An unbilled project gets
      // a 429 whose body says `limit: 0` on a free_tier metric — that is a
      // billing state, not congestion, and retrying never clears it. Only the
      // body separates "enable billing" from "retry shortly".
      if (/free_tier/i.test(text) && /limit:\s*0/i.test(text)) {
        throw new Error(
          "Gemini image generation requires a paid tier. Enable billing on the Google project behind GEMINI_API_KEY.",
        );
      }
      throw new Error("Rate limited by Gemini. Try again in a moment.");
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Gemini rejected GEMINI_API_KEY (${res.status}).`);
    }
    throw new Error(`Vision provider error (${res.status}) [${providerLabel}]: ${text}`);
  }

  const json = (await res.json()) as GeminiResponse;
  const candidate = json.candidates?.[0];
  if (!candidate) {
    const blocked = json.promptFeedback?.blockReason;
    throw new Error(
      blocked ? `Gemini refused the edit (${blocked}).` : "Gemini returned no candidates",
    );
  }

  // Image-only single part: scan for inlineData rather than assuming a slot.
  for (const part of candidate.content?.parts ?? []) {
    const inline = part.inlineData;
    if (inline?.data) {
      return { mimeType: inline.mimeType ?? "image/jpeg", data: inline.data };
    }
  }

  // A truncated or filtered generation still returns a candidate, just without
  // an image part — say which, instead of a bare "no image data".
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(`Gemini stopped before returning an image (${candidate.finishReason}).`);
  }
  throw new Error("Provider returned no image data");
}

/**
 * OpenAI direct has no 402: quota exhaustion arrives as a 429 whose error body
 * carries `"code": "insufficient_quota"` — the same status as an ordinary rate
 * limit. Only the body separates "add billing" from "retry shortly", so we
 * inspect it rather than telling the user to try again forever.
 */
async function parseOpenAIResponse(res: Response, providerLabel: string): Promise<InlineImage> {
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429 && /insufficient_quota/i.test(text)) {
      throw new Error(
        "OpenAI quota exhausted. Add credit to the OpenAI account to keep rendering.",
      );
    }
    if (res.status === 429) throw new Error("Rate limited by OpenAI. Try again in a moment.");
    if (res.status === 401) throw new Error("OpenAI rejected OPENAI_API_KEY (401).");
    throw new Error(`Vision provider error (${res.status}) [${providerLabel}]: ${text}`);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = json.data?.[0];
  if (item?.b64_json) return { mimeType: "image/png", data: item.b64_json };
  if (item?.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error(`Failed to fetch generated image: ${imgRes.status}`);
    const mimeType = (imgRes.headers.get("content-type") ?? "image/png").split(";")[0]!.trim();
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
    return { mimeType, data: btoa(bin) };
  }
  throw new Error("Provider returned no image data");
}

/**
 * The two render paths sit on different upstreams and different keys, so the
 * provider takes both and validates each at render time — a deployment holding
 * only one key still gets the path that key can serve, instead of failing every
 * render up front.
 */
export interface VisionProviderKeys {
  /** Text-to-image (OpenAI direct). */
  openaiApiKey?: string;
  /** Image-edit (Gemini direct). */
  geminiApiKey?: string;
}

export function createVisionProvider(keys: VisionProviderKeys): VisionProvider {
  return {
    // Surface the dynamic model in the name so audit rows show which path ran.
    name: "vision/auto",
    supportedResolutions: ["hd"] as const,
    async render(input: VisionRenderInput): Promise<VisionRenderResult> {
      const descriptor = STYLE_DESCRIPTORS[input.style] ?? input.style;

      // === Path 1: IMAGE-EDIT via Gemini direct (true img2img) ===
      if (input.sourceImageUrl) {
        if (!keys.geminiApiKey) {
          throw new Error(
            "Image edit needs GEMINI_API_KEY. Remove the source photo to render text-to-image instead.",
          );
        }
        const source = await fetchSourceImage(input.sourceImageUrl);
        const editPrompt =
          `Redesign THIS exact room in ${input.style} interior style ` +
          `(${descriptor}). Preserve the existing room geometry, window/door ` +
          `placement, ceiling height, and camera angle from the source photo. ` +
          `Only restyle finishes, furniture, lighting, and decor. ` +
          `Additional direction: ${input.prompt}`;

        // No `generationConfig`: responseModalities is not required and the
        // model defaults to image output. See the file header.
        const body = {
          contents: [
            {
              parts: [
                { text: editPrompt },
                { inline_data: { mime_type: source.mimeType, data: source.data } },
              ],
            },
          ],
        };

        const res = await fetch(
          `${GEMINI_API_BASE}/models/${IMAGE_EDIT_MODEL}:generateContent`,
          {
            method: "POST",
            headers: {
              "x-goog-api-key": keys.geminiApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          },
        );
        const img = await parseGeminiResponse(res, IMAGE_EDIT_MODEL);
        return {
          provider: `google/${IMAGE_EDIT_MODEL}`,
          imageBase64: img.data,
          mimeType: img.mimeType,
        };
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
      const img = await parseOpenAIResponse(res, TEXT_TO_IMAGE_MODEL);
      return {
        provider: `openai/${TEXT_TO_IMAGE_MODEL}`,
        imageBase64: img.data,
        mimeType: img.mimeType,
      };
    },
  };
}
