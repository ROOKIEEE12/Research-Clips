import type { Extracted, ProviderName, Synthesis } from "../types.js";
import { warn } from "../util.js";
import { DEFAULT_ANTHROPIC_MODEL, synthesizeWithAnthropic } from "./anthropic.js";
import { DEFAULT_GEMINI_MODEL, synthesizeWithGemini } from "./gemini.js";
import { synthesizeOffline } from "./offline.js";
import { DEFAULT_OLLAMA_MODEL, synthesizeWithOllama } from "./ollama.js";
import { DEFAULT_OPENAI_MODEL, synthesizeWithOpenAI } from "./openai.js";
import { buildUserPrompt } from "./prompt.js";

export const PROVIDERS: ProviderName[] = ["anthropic", "openai", "gemini", "ollama", "none"];

const DEFAULT_MODELS: Record<ProviderName, string | undefined> = {
  anthropic: DEFAULT_ANTHROPIC_MODEL,
  openai: DEFAULT_OPENAI_MODEL,
  gemini: DEFAULT_GEMINI_MODEL,
  ollama: DEFAULT_OLLAMA_MODEL,
  none: undefined,
};

// Rough per-provider input budgets in characters (~4 chars/token), leaving headroom for output.
const DEFAULT_MAX_CHARS: Record<ProviderName, number | undefined> = {
  anthropic: 2_400_000,
  openai: 1_600_000,
  gemini: 2_400_000,
  ollama: 100_000,
  none: undefined,
};

export interface SynthOptions {
  provider: ProviderName;
  model?: string;
  ollamaUrl?: string;
  maxInputChars?: number;
}

export function resolveModel(provider: ProviderName, model?: string) {
  return model ?? DEFAULT_MODELS[provider];
}

export async function synthesize(doc: Extracted, opts: SynthOptions): Promise<Synthesis> {
  if (!PROVIDERS.includes(opts.provider)) {
    throw new Error(`Unknown provider "${opts.provider}". Use one of: ${PROVIDERS.join(", ")}.`);
  }
  if (opts.provider === "none") return synthesizeOffline(doc);

  const maxChars = opts.maxInputChars ?? DEFAULT_MAX_CHARS[opts.provider];
  const { prompt, truncated } = buildUserPrompt(doc, maxChars);
  if (truncated) {
    warn(`Source is ${doc.content.length.toLocaleString()} chars; only the first ${maxChars!.toLocaleString()} were sent for synthesis (the full text is still saved). Raise maxInputChars to change this.`);
  }

  const model = resolveModel(opts.provider, opts.model);
  switch (opts.provider) {
    case "anthropic": return synthesizeWithAnthropic(prompt, model);
    case "openai": return synthesizeWithOpenAI(prompt, model);
    case "gemini": return synthesizeWithGemini(prompt, model);
    case "ollama": return synthesizeWithOllama(prompt, model, opts.ollamaUrl);
  }
}
