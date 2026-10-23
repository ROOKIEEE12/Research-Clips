import { z } from "zod";
import { SynthesisSchema, type Extracted } from "../types.js";

export const SYSTEM_PROMPT = `You turn research material into a concise, structured note for a developer's personal knowledge base.

Return JSON with:
- summary: exactly 3 bullets, each one sentence, stating what the material is and why it matters. No filler like "This article discusses".
- takeaways: 3-7 concrete, actionable takeaways or findings (methods, numbers, trade-offs, gotchas).
- snippets: up to 3 of the most useful code snippets, copied verbatim from the source with the right language tag and a one-line caption. Use an empty array when the source has no code. Never invent code.
- tags: 3-8 lowercase kebab-case topic tags (technologies, fields, concepts), no "#".

Base everything strictly on the provided material.`;

export function buildUserPrompt(doc: Extracted, maxChars?: number): { prompt: string; truncated: boolean } {
  let content = doc.content;
  const truncated = maxChars !== undefined && content.length > maxChars;
  if (truncated) content = content.slice(0, maxChars) + "\n\n[...truncated...]";

  const header = [
    `Title: ${doc.title}`,
    `Source type: ${doc.kind}`,
    `URL: ${doc.source}`,
    doc.author ? `Author: ${doc.author}` : "",
    doc.published ? `Published: ${doc.published}` : "",
    doc.excerpt ? `Description: ${doc.excerpt}` : "",
  ].filter(Boolean).join("\n");

  return { prompt: `${header}\n\n<content>\n${content}\n</content>`, truncated };
}

/** JSON Schema for providers that take one directly (OpenAI strict mode, Ollama, Gemini). */
export function synthesisJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(SynthesisSchema) as Record<string, unknown>;
  delete schema.$schema;
  return strictify(schema);
}

function strictify(node: unknown): any {
  if (Array.isArray(node)) return node.map(strictify);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) out[k] = strictify(v);
  if (out.type === "object" && out.properties) {
    out.additionalProperties = false;
    out.required = Object.keys(out.properties as object);
  }
  return out;
}

/** Parse model JSON output, tolerating a ```json fence around it. */
export function parseSynthesis(raw: string) {
  const json = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return SynthesisSchema.parse(JSON.parse(json));
}
