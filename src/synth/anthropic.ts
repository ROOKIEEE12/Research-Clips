import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { SynthesisSchema, type Synthesis } from "../types.js";
import { SYSTEM_PROMPT } from "./prompt.js";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

// Models that accept the server-side refusal fallback ("default" routing).
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export async function synthesizeWithAnthropic(prompt: string, model = DEFAULT_ANTHROPIC_MODEL): Promise<Synthesis> {
  // Credentials resolve from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / `ant auth login`.
  const client = new Anthropic();
  const useFallback = FALLBACK_MODELS.has(model);

  const response = await client.beta.messages
    .parse({
      model,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
      // Summarization is a simple task: low effort keeps clips fast and cheap.
      output_config: { effort: "low", format: zodOutputFormat(SynthesisSchema) },
      ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
    })
    .catch((err: Error) => {
      if (/authentication method/i.test(err.message)) {
        throw new Error("No Anthropic credentials found. Set ANTHROPIC_API_KEY (or run `ant auth login`), or use -p ollama / -p none.");
      }
      throw err;
    });

  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined to summarize this source (${response.stop_details?.category ?? "unspecified"}).`);
  }
  if (response.stop_reason === "max_tokens") throw new Error("Claude's response hit max_tokens before finishing.");
  if (!response.parsed_output) throw new Error("Claude returned output that did not match the note schema.");
  return response.parsed_output;
}
