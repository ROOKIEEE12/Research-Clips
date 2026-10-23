import { stringify } from "yaml";
import type { Clip } from "../types.js";

export interface RenderOptions {
  includeContent: boolean;
  extraFrontmatter?: Record<string, unknown>;
}

export function buildFrontmatter(clip: Clip, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const { extracted: doc, synthesis } = clip;
  const fm: Record<string, unknown> = {
    title: doc.title,
    source: doc.source,
    type: doc.kind,
    author: doc.author,
    published: doc.published,
    site: doc.siteName,
    clipped: clip.clippedAt.toISOString(),
    tags: clip.tags,
    summary: synthesis.summary.join(" "),
    ...doc.meta,
    ...(clip.model ? { synthesized_by: `${clip.provider}/${clip.model}` } : {}),
    ...extra,
  };
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete fm[k];
  }
  return fm;
}

export function renderMarkdown(clip: Clip, opts: RenderOptions): string {
  const { extracted: doc, synthesis } = clip;
  const parts: string[] = [
    `---\n${stringify(buildFrontmatter(clip, opts.extraFrontmatter), { lineWidth: 0 }).trimEnd()}\n---`,
    `# ${doc.title}`,
    `[Source](${doc.source.startsWith("http") ? doc.source : encodeURI("file:///" + doc.source.replace(/\\/g, "/"))})` +
      (doc.author ? ` · ${doc.author}` : "") +
      (doc.published ? ` · ${doc.published}` : ""),
  ];

  if (synthesis.summary.length) {
    parts.push(["> [!summary] Executive Summary", ...synthesis.summary.map((s) => `> - ${s}`)].join("\n"));
  }
  if (synthesis.takeaways.length) {
    parts.push(["## Key Takeaways", "", ...synthesis.takeaways.map((t) => `- ${t}`)].join("\n"));
  }
  if (synthesis.snippets.length) {
    parts.push(
      [
        "## Code Snippets",
        ...synthesis.snippets.map((s) => {
          const fence = s.code.includes("```") ? "````" : "```";
          return `${s.caption ? `\n${s.caption}\n` : ""}\n${fence}${s.language}\n${s.code.trimEnd()}\n${fence}`;
        }),
      ].join("\n"),
    );
  }
  if (opts.includeContent && doc.content) {
    parts.push(`## Content\n\n${demoteHeadings(doc.content)}`);
  }
  return parts.join("\n\n") + "\n";
}

/** Push source headings below our own "## Content" so the note outline stays clean. */
function demoteHeadings(md: string): string {
  let inFence = false;
  return md
    .split("\n")
    .map((line) => {
      if (/^(```|~~~)/.test(line)) inFence = !inFence;
      if (inFence) return line;
      const m = /^(#{1,6})\s/.exec(line);
      if (!m) return line;
      const level = Math.min(6, m[1].length + 2);
      return "#".repeat(level) + line.slice(m[1].length);
    })
    .join("\n");
}
