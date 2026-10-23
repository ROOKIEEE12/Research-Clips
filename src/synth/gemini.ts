import type { Synthesis } from "../types.js";
import { parseSynthesis, synthesisJsonSchema, SYSTEM_PROMPT } from "./prompt.js";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export async function synthesizeWithGemini(prompt: string, model = DEFAULT_GEMINI_MODEL): Promise<Synthesis> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: synthesisJsonSchema() },
      }),
      signal: AbortSignal.timeout(180_000),
    },
  );
  if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;
  const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`Gemini returned no content (${data.candidates?.[0]?.finishReason ?? "unknown reason"}).`);
  return parseSynthesis(text);
}
