// Vision Studio provider interface. Real (Lovable AI) lives alongside a mock
// so the engine still renders if the gateway is down or out of credits.

export type VisionResolution = "hd" | "2k" | "4k";

export const RESOLUTION_SIZES: Record<VisionResolution, string> = {
  hd: "1024x1024",
  "2k": "2048x2048",
  "4k": "4096x4096",
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
  render(input: VisionRenderInput): Promise<VisionRenderResult>;
}
