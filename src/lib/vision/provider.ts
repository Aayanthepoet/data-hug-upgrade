// Vision Studio provider interface. Real (Lovable AI) lives alongside a mock
// so the engine still renders if the gateway is down or out of credits.

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
  // PNG image as base64-encoded bytes (no data: prefix).
  imageBase64: string;
}

export interface VisionProvider {
  name: string;
  // Resolutions this provider can actually render. Server validates the
  // requested resolution against this list and surfaces a clear UI error
  // when a tier is unsupported (e.g. 4K on the current upstream).
  supportedResolutions: readonly VisionResolution[];
  render(input: VisionRenderInput): Promise<VisionRenderResult>;
}
