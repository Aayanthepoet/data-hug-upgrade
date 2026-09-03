// One Anthropic entry point for every engine that needs a model call.
//
// Replaces createLovableAiGatewayProvider for the TEXT engines. It does NOT
// replace the gateway everywhere — Vision Studio, TTS and transcription stay on
// LOVABLE_API_KEY because Anthropic has no image, speech-to-text or
// text-to-speech endpoint. See the comments on those three files.
//
// Two surfaces, because callers need different things:
//
//   aiModel()      — a Vercel AI SDK model handle. Every engine here is already
//                    built on generateText/streamText/Output.object, so this is
//                    a one-line swap at the call site and nothing else moves.
//
//   completeText() — prompt in, text and token usage out, straight through the
//                    raw Anthropic SDK. Nothing uses it yet; it is here for
//                    callers that only ever wanted a string and should not have
//                    to carry the AI SDK. foreclosure.functions.ts already talks
//                    to Anthropic by hand and is the obvious first adopter.
//
// Both read the same key and the same model table, so a tier change is one edit.

import Anthropic from "@anthropic-ai/sdk";
import { createAnthropic } from "@ai-sdk/anthropic";

/** Pinned here so a tier change is one edit rather than a grep across engines.
 *
 *  The engines previously asked the gateway for google/gemini-3-flash-preview —
 *  a fast, cheap tier. `cheap` is the closest equivalent; `balanced` is the step
 *  up, used where output quality is read by a person or drives a tool loop. */
export const MODELS = {
  /** Short, structured, low-reasoning calls where output tokens dominate. */
  cheap: "claude-haiku-4-5",
  /** Step up when the cheap tier's output comes back too thin. */
  balanced: "claude-sonnet-5",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

let client: Anthropic | null = null;

/** Lazy so importing this module never throws — only calling it does, at the
 *  point where a missing key is actually about to matter. */
export function getAnthropicClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  client = new Anthropic({ apiKey });
  return client;
}

let aiProvider: ReturnType<typeof createAnthropic> | null = null;

/** AI SDK model handle. Same key and same model table as completeText. */
export function aiModel(model: ModelId = MODELS.balanced) {
  if (!aiProvider) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
    aiProvider = createAnthropic({ apiKey });
  }
  return aiProvider(model);
}

export type TextCompletion = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** "end_turn" on a clean finish. "max_tokens" means the text is cut off and
   *  "refusal" means there is no answer — both worth checking before parsing. */
  stopReason: string | null;
};

export async function completeText(opts: {
  model: ModelId;
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<TextCompletion> {
  const message = await getAnthropicClient().messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });

  // content is a union of block types; only text blocks carry prose. Joining
  // rather than taking [0] stays correct if a response arrives split.
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return {
    text,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    stopReason: message.stop_reason,
  };
}
