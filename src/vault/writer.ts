import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import type { Clip } from "../types.js";
import { slugify, warn } from "../util.js";
import { buildFrontmatter } from "./markdown.js";

const run = promisify(execFile);

export function noteFileName(clip: Clip): string {
  return `${clip.clippedAt.toISOString().slice(0, 10)}-${slugify(clip.extracted.title)}.md`;
}

/** Write the note without ever overwriting an existing one; returns the absolute path. */
export function writeNote(dir: string, fileName: string, markdown: string): string {
  mkdirSync(dir, { recursive: true });
  const stem = fileName.replace(/\.md$/, "");
  let path = join(dir, fileName);
  for (let i = 2; existsSync(path); i++) path = join(dir, `${stem}-${i}.md`);
  writeFileSync(path, markdown, "utf8");
  return path;
}

export async function gitCommit(vault: string, file: string, title: string): Promise<boolean> {
  try {
    await run("git", ["-C", vault, "rev-parse", "--is-inside-work-tree"]);
  } catch {
    warn(`Vault ${vault} is not a git repository; skipping commit (run \`git init\` there to enable).`);
    return false;
  }
  try {
    await run("git", ["-C", vault, "add", "--", relative(vault, file)]);
    await run("git", ["-C", vault, "commit", "-m", `clip: ${title}`, "--", relative(vault, file)]);
    return true;
  } catch (err) {
    warn(`git commit failed: ${(err as any).stderr?.trim() || (err as Error).message}`);
    return false;
  }
}

/** POST the clip to a webhook (Notion via Make/Zapier/n8n, Slack, custom indexers...). */
export async function sendWebhook(url: string, clip: Clip, markdown: string, path: string): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      frontmatter: buildFrontmatter(clip),
      synthesis: clip.synthesis,
      markdown,
      path,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Webhook returned HTTP ${res.status}`);
}
