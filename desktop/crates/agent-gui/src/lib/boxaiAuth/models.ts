// BOXAI: curated model catalog for the locked BoxAI providers.
//
// The desktop ships a fixed model list rather than fetching one. These IDs must
// match the models your boxAI server/gateway exposes for each transport; edit
// this file to match your deployment's catalog.

export const BOXAI_CLAUDE_MODELS: readonly string[] = [
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-1-20250805",
  "claude-3-5-haiku-20241022",
];

export const BOXAI_OPENAI_MODELS: readonly string[] = ["gpt-4o", "gpt-4o-mini", "gpt-4.1"];
