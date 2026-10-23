import { JSDOM } from "jsdom";
import type { Extracted } from "../types.js";
import { httpGet } from "../util.js";
import { parsePdf } from "./pdf.js";

/** Matches new-style (2401.12345v2) and old-style (cs/0101001) arXiv identifiers. */
export function parseArxivId(url: URL): string | undefined {
  if (!/(^|\.)arxiv\.org$/.test(url.hostname)) return undefined;
  const m = /^\/(?:abs|pdf|html)\/(.+?)(?:\.pdf)?\/?$/.exec(url.pathname);
  return m?.[1];
}

export async function ingestArxiv(id: string): Promise<Extracted> {
  const atom = await (await httpGet(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`)).text();
  const doc = new JSDOM(atom, { contentType: "text/xml" }).window.document;
  const entry = doc.querySelector("entry");
  const text = (sel: string) => entry?.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim();
  const title = text("title");
  if (!entry || !title || title === "Error") throw new Error(`arXiv paper ${id} not found.`);

  const authors = [...entry.querySelectorAll("author > name")].map((n) => n.textContent!.trim());
  const categories = [...entry.getElementsByTagName("category")].map((c) => c.getAttribute("term")!).filter(Boolean);
  const abstract = text("summary") ?? "";
  const published = text("published")?.slice(0, 10);

  let body = "";
  let pages: number | undefined;
  try {
    const pdf = await parsePdf(new Uint8Array(await (await httpGet(`https://arxiv.org/pdf/${id}`, {}, 60_000)).arrayBuffer()));
    body = pdf.text;
    pages = pdf.pages;
  } catch (err) {
    // The abstract alone is still a useful clip.
    body = `_Full text unavailable: ${(err as Error).message}_`;
  }

  return {
    kind: "arxiv",
    source: `https://arxiv.org/abs/${id}`,
    title,
    author: authors.join(", "),
    published,
    siteName: "arXiv",
    excerpt: abstract,
    content: `## Abstract\n\n${abstract}\n\n## Full Text\n\n${body}`,
    meta: {
      arxiv_id: id,
      categories,
      pdf: `https://arxiv.org/pdf/${id}`,
      ...(pages ? { pages } : {}),
    },
  };
}
