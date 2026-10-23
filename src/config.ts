import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { ProviderName } from "./types.js";

export interface Config {
  /** Root of the Markdown vault (e.g. your Obsidian vault). */
  vault: string;
  /** Sub-folder inside the vault where clips are written. */
  folder: string;
  provider: ProviderName;
  /** Model override; each provider has its own default. */
  model?: string;
  ollamaUrl: string;
  /** Input longer than this is truncated (with a warning) before synthesis. */
  maxInputChars?: number;
  /** Include the full extracted content below the synthesis. */
  includeContent: boolean;
  /** Commit each new clip if the vault is a git repository. */
  git: boolean;
  /** Optional URL that receives a JSON POST for every clip (Notion automations, Zapier, n8n...). */
  webhook?: string;
  /** Static fields merged into every note's frontmatter. */
  frontmatter: Record<string, unknown>;
  /** Port for `clip serve`. */
  port: number;
}

export const DEFAULTS: Config = {
  vault: join(homedir(), "ResearchClips"),
  folder: "Clips",
  provider: "anthropic",
  ollamaUrl: "http://127.0.0.1:11434",
  includeContent: true,
  git: false,
  frontmatter: {},
  port: 7777,
};

export function configPath(): string {
  return process.env.RESEARCH_CLIPS_CONFIG ?? join(homedir(), ".research-clips", "config.json");
}

export function loadConfig(): Config {
  const path = configPath();
  let fromFile: Partial<Config> = {};
  if (existsSync(path)) {
    try {
      fromFile = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      throw new Error(`Could not parse config at ${path}: ${(err as Error).message}`);
    }
  }
  const config: Config = { ...DEFAULTS, ...fromFile };
  if (process.env.RESEARCH_CLIPS_VAULT) config.vault = process.env.RESEARCH_CLIPS_VAULT;
  if (process.env.RESEARCH_CLIPS_PROVIDER) config.provider = process.env.RESEARCH_CLIPS_PROVIDER as ProviderName;
  config.vault = resolve(expandHome(config.vault));
  return config;
}

export function writeConfig(config: Partial<Config>): string {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
  return path;
}

function expandHome(p: string): string {
  return p === "~" || p.startsWith("~/") || p.startsWith("~\\") ? join(homedir(), p.slice(1)) : p;
}
