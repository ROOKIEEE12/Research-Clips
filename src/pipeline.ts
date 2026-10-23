import { join } from "node:path";
import type { Config } from "./config.js";
import { ingest } from "./ingest/index.js";
import { resolveModel, synthesize } from "./synth/index.js";
import type { Clip, ProviderName } from "./types.js";
import { log, mergeTags, warn } from "./util.js";
import { renderMarkdown } from "./vault/markdown.js";
import { gitCommit, noteFileName, sendWebhook, writeNote } from "./vault/writer.js";

export interface ClipOptions {
  tags?: string[];
  provider?: ProviderName;
  model?: string;
  folder?: string;
  render?: boolean;
  includeContent?: boolean;
  git?: boolean;
  /** Render the note but don't write it anywhere. */
  dryRun?: boolean;
  quiet?: boolean;
}

export interface ClipResult {
  clip: Clip;
  markdown: string;
  path?: string;
  ms: number;
}

export async function runClip(source: string, config: Config, opts: ClipOptions = {}): Promise<ClipResult> {
  const started = Date.now();
  const say = opts.quiet ? () => {} : log;
  const provider = opts.provider ?? config.provider;
  const model = resolveModel(provider, opts.model ?? config.model);

  say(`Fetching ${source}`);
  const extracted = await ingest(source, { render: opts.render });
  say(`Extracted ${extracted.kind}: "${extracted.title}" (${extracted.content.length.toLocaleString()} chars)`);

  say(provider === "none" ? "Building offline summary" : `Synthesizing with ${provider}/${model}`);
  const synthesis = await synthesize(extracted, {
    provider,
    model,
    ollamaUrl: config.ollamaUrl,
    maxInputChars: config.maxInputChars,
  });

  const clip: Clip = {
    extracted,
    synthesis,
    tags: mergeTags(opts.tags ?? [], synthesis.tags),
    clippedAt: new Date(),
    provider,
    model,
  };
  const markdown = renderMarkdown(clip, {
    includeContent: opts.includeContent ?? config.includeContent,
    extraFrontmatter: config.frontmatter,
  });

  if (opts.dryRun) return { clip, markdown, ms: Date.now() - started };

  const path = writeNote(join(config.vault, opts.folder ?? config.folder), noteFileName(clip), markdown);

  if (opts.git ?? config.git) {
    if (await gitCommit(config.vault, path, extracted.title)) say("Committed to vault git repo");
  }
  if (config.webhook) {
    await sendWebhook(config.webhook, clip, markdown, path).then(
      () => say("Webhook delivered"),
      (err) => warn(`Webhook failed: ${(err as Error).message}`),
    );
  }

  return { clip, markdown, path, ms: Date.now() - started };
}
