import type { Synthesis } from "../types.js";
import { parseSynthesis, synthesisJsonSchema, SYSTEM_PROMPT } from "./prompt.js";

export const DEFAULT_OLLAMA_MODEL = "llama3.2";

export async function synthesizeWithOllama(
  prompt: string,
  model = DEFAULT_OLLAMA_MODEL,
  baseUrl = "http://127.0.0.1:11434",
): Promise<Synthesis> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: synthesisJsonSchema(),
        options: { temperature: 0.2, num_ctx: 32768 },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(600_000),
    });
  } catch (err) {
    throw new Error(`Could not reach Ollama at ${baseUrl} — is \`ollama serve\` running? (${(err as Error).message})`);
  }
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  return parseSynthesis(data.message?.content ?? "");
}
