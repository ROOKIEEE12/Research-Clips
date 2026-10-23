import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import TurndownService from "turndown";
import type { Extracted } from "../types.js";
import { httpGet } from "../util.js";
import { ingestPdfBytes } from "./pdf.js";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});

// Keep the language hint from <pre><code class="language-ts"> in fenced blocks.
turndown.addRule("fencedCodeWithLanguage", {
  filter: (node) => node.nodeName === "PRE" && node.firstChild?.nodeName === "CODE",
  replacement: (_content, node) => {
    const code = node.firstChild as HTMLElement;
    const lang = /(?:lang|language)-([\w+-]+)/.exec(code.getAttribute("class") ?? "")?.[1] ?? "";
    const text = (code.textContent ?? "").replace(/\n$/, "");
    return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
  },
});
turndown.remove(["script", "style", "noscript", "iframe"]);

export interface WebOptions {
  /** Render the page in a headless browser first (needs `playwright` installed). */
  render?: boolean;
}

export async function ingestWeb(url: URL, opts: WebOptions = {}): Promise<Extracted> {
  if (opts.render) return htmlToExtracted(await renderWithPlaywright(url), url.href);

  const res = await httpGet(url, { accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8" });
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/pdf")) {
    return ingestPdfBytes(new Uint8Array(await res.arrayBuffer()), res.url || url.href);
  }
  return htmlToExtracted(await res.text(), res.url || url.href);
}

export function htmlToExtracted(html: string, url: string): Extracted {
  const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
  const doc = dom.window.document;
  const meta = (name: string) =>
    doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content")?.trim() || undefined;

  const article = new Readability(doc.cloneNode(true) as Document, { keepClasses: true }).parse();
  const contentHtml = article?.content ?? doc.body?.innerHTML ?? "";
  const content = turndown.turndown(contentHtml).replace(/\n{3,}/g, "\n\n").trim();

  if (!content) throw new Error(`No readable content found at ${url}. Try --render for JavaScript-heavy pages.`);

  return {
    kind: "web",
    source: url,
    title: article?.title?.trim() || meta("og:title") || doc.title || url,
    author: article?.byline?.trim() || meta("author") || meta("article:author"),
    published: article?.publishedTime ?? meta("article:published_time"),
    siteName: article?.siteName ?? meta("og:site_name") ?? new URL(url).hostname,
    excerpt: article?.excerpt?.trim() || meta("description") || meta("og:description"),
    content,
    meta: {},
  };
}

async function renderWithPlaywright(url: URL): Promise<string> {
  let playwright: any;
  try {
    // Optional dependency: only loaded when --render is used.
    playwright = await import(/* webpackIgnore: true */ "playwright" as string);
  } catch {
    throw new Error("--render needs Playwright: run `npm install -g playwright && npx playwright install chromium`.");
  }
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url.href, { waitUntil: "networkidle", timeout: 45_000 });
    return await page.content();
  } finally {
    await browser.close();
  }
}
