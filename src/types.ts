import { z } from "zod";

export type SourceKind = "web" | "github" | "arxiv" | "pdf" | "file";

/** Clean, provider-agnostic output of the ingestion stage. */
export interface Extracted {
  kind: SourceKind;
  /** Canonical source URL (or absolute file path for local files). */
  source: string;
  title: string;
  author?: string;
  published?: string;
  siteName?: string;
  /** Short description / abstract, if the source exposes one. */
  excerpt?: string;
  /** Main content as Markdown. */
  content: string;
  /** Source-specific facts that end up in the frontmatter (stars, languages, categories...). */
  meta: Record<string, string | number | string[]>;
}

export const SynthesisSchema = z.object({
  summary: z.array(z.string()).describe("Exactly 3 concise executive-summary bullets"),
  takeaways: z.array(z.string()).describe("3-7 actionable key takeaways or findings"),
  snippets: z
    .array(
      z.object({
        language: z.string().describe("Language for the fenced code block, e.g. ts, bash"),
        code: z.string(),
        caption: z.string().describe("One line explaining the snippet"),
      }),
    )
    .describe("Up to 3 of the most useful code snippets copied verbatim from the source; empty if none"),
  tags: z.array(z.string()).describe("3-8 lowercase kebab-case topic tags"),
});

export type Synthesis = z.infer<typeof SynthesisSchema>;

export type ProviderName = "anthropic" | "openai" | "gemini" | "ollama" | "none";

export interface Clip {
  extracted: Extracted;
  synthesis: Synthesis;
  tags: string[];
  clippedAt: Date;
  provider: ProviderName;
  model?: string;
}
