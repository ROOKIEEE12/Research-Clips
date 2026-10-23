import type { Synthesis } from "../types.js";
import { parseSynthesis, synthesisJsonSchema, SYSTEM_PROMPT } from "./prompt.js";

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

export async function synthesizeWithOpenAI(prompt: string, model = DEFAULT_OPENAI_MODEL): Promise<Synthesis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "research_note", strict: true, schema: synthesisJsonSchema() },
      },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  const message = data.choices?.[0]?.message;
  if (message?.refusal) throw new Error(`OpenAI declined: ${message.refusal}`);
  return parseSynthesis(message?.content ?? "");
}
