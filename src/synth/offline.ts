import type { Extracted, Synthesis } from "../types.js";

/** No-LLM fallback (`--provider none`): heuristic summary, fenced code blocks, and source-derived tags. */
export function synthesizeOffline(doc: Extracted): Synthesis {
  const prose = (doc.excerpt || stripMarkdown(doc.content)).replace(/\s+/g, " ");
  // Split only where terminal punctuation is followed by whitespace, so "Node.js" or "e.g." stay intact.
  const sentences = prose.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map((s) => s.trim()).filter((s) => s.length > 20);
  const summary = sentences.slice(0, 3);
  if (!summary.length && prose) summary.push(prose.slice(0, 280));

  const headings = [...doc.content.matchAll(/^#{2,3}\s+(.+)$/gm)].map((m) => m[1].trim());
  const snippets = [...doc.content.matchAll(/```([\w+-]*)\n([\s\S]*?)```/g)]
    .filter((m) => m[1] !== "tree" && m[2].trim().split("\n").length >= 2)
    .slice(0, 3)
    .map((m) => ({ language: m[1] || "text", code: m[2].trimEnd(), caption: "" }));

  const metaTags = [doc.meta.language, ...[doc.meta.topics ?? []].flat(), ...[doc.meta.categories ?? []].flat()]
    .filter((t): t is string => typeof t === "string" && t.length > 0);

  return {
    summary,
    takeaways: headings.slice(0, 7).map((h) => `Covers: ${h}`),
    snippets,
    tags: [doc.kind, ...metaTags],
  };
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s.*$/gm, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>|]/g, "");
}
