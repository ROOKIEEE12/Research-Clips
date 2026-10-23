import { existsSync, readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Extracted } from "../types.js";
import { httpGet } from "../util.js";
import { ingestArxiv, parseArxivId } from "./arxiv.js";
import { ingestGitHub, parseGitHubRepo } from "./github.js";
import { ingestPdfBytes } from "./pdf.js";
import { htmlToExtracted, ingestWeb, type WebOptions } from "./web.js";

export type IngestOptions = WebOptions;

/** Route a URL or local path to the right extractor. */
export async function ingest(source: string, opts: IngestOptions = {}): Promise<Extracted> {
  if (!/^https?:\/\//i.test(source) && existsSync(source)) return ingestFile(resolve(source));

  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(source) ? source : `https://${source}`);
  } catch {
    throw new Error(`Not a valid URL or file path: ${source}`);
  }

  const arxivId = parseArxivId(url);
  if (arxivId) return ingestArxiv(arxivId);

  const repo = parseGitHubRepo(url);
  if (repo) return ingestGitHub(repo);

  if (url.pathname.toLowerCase().endsWith(".pdf")) {
    const res = await httpGet(url, {}, 60_000);
    return ingestPdfBytes(new Uint8Array(await res.arrayBuffer()), url.href);
  }

  return ingestWeb(url, opts);
}

async function ingestFile(path: string): Promise<Extracted> {
  const ext = extname(path).toLowerCase();
  if (ext === ".pdf") return ingestPdfBytes(new Uint8Array(readFileSync(path)), path);

  const text = readFileSync(path, "utf8");
  if (ext === ".html" || ext === ".htm") return { ...htmlToExtracted(text, pathToFileURL(path).href), kind: "file", source: path };

  return {
    kind: "file",
    source: path,
    title: /^#\s+(.+)$/m.exec(text)?.[1].trim() ?? basename(path, ext),
    content: text.trim(),
    meta: {},
  };
}
