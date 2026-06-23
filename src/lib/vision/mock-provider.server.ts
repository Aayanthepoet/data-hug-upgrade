// Deterministic mock vision provider — a tiny solid-color PNG. Used when no
// LOVABLE_API_KEY is configured so dev/test runs don't burn credits.

import type { VisionProvider } from "./provider";

// 1x1 transparent PNG
const TINY_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export const mockVisionProvider: VisionProvider = {
  name: "mock-vision",
  supportedResolutions: ["hd", "2k", "4k"],
  async render() {
    return { provider: "mock-vision", imageBase64: TINY_PNG_B64 };
  },
};
