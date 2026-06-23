// Vision Studio provider interface. Real (Lovable AI) lives alongside a mock
// so the engine still renders if the gateway is down or out of credits.

export interface VisionRenderInput {
  prompt: string;
  style: string;
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
