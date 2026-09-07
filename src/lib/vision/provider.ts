// Vision Studio provider interface. The real provider (Gemini for image-edit,
// OpenAI for text-to-image) lives alongside a mock so the engine still renders
// when no key is configured or an upstream is down.

export type VisionResolution = "hd" | "2k" | "4k";

export const RESOLUTION_SIZES: Record<VisionResolution, string> = {
  hd: "1024x1024",
  "2k": "2048x2048",
  "4k": "4096x4096",
};

export const RESOLUTION_LABELS: Record<VisionResolution, string> = {
  hd: "HD (1024×1024)",
  "2k": "2K (2048×2048)",
  "4k": "4K (4096×4096)",
};

export interface VisionRenderInput {
  prompt: string;
  style: string;
  resolution: VisionResolution;
  sourceImageUrl?: string | null;
}

export interface VisionRenderResult {
  provider: string;
  // Rendered image as base64-encoded bytes (no data: prefix).
  imageBase64: string;
  // Upstreams disagree on format: gpt-image-2 returns PNG, gemini-3.1-flash-image
  // returns JPEG regardless of the source format. Carried through so the stored
  // object gets a truthful extension and content-type instead of every render
  // being labelled .png.
  mimeType: string;
}

export interface VisionProvider {
  name: string;
  // Resolutions this provider can actually render. Server validates the
  // requested resolution against this list and surfaces a clear UI error
  // when a tier is unsupported (e.g. 4K on the current upstream).
  supportedResolutions: readonly VisionResolution[];
  render(input: VisionRenderInput): Promise<VisionRenderResult>;
}
