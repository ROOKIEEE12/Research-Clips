import { extractText, getDocumentProxy } from "unpdf";
import type { Extracted } from "../types.js";

export interface ParsedPdf {
  text: string;
  pages: number;
  title?: string;
  author?: string;
}

export async function parsePdf(bytes: Uint8Array): Promise<ParsedPdf> {
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  let info: Record<string, unknown> = {};
  try {
    info = ((await pdf.getMetadata()).info ?? {}) as Record<string, unknown>;
  } catch {
    // Metadata is optional; plenty of PDFs have none.
  }
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  return { text: cleanPdfText(text), pages: totalPages, title: str(info.Title), author: str(info.Author) };
}

/** Undo the most common PDF extraction artifacts: hyphenated line breaks and ragged whitespace. */
export function cleanPdfText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Best-effort abstract detection for papers that aren't on arXiv. */
export function findAbstract(text: string): string | undefined {
  const match = /\babstract\b[\s.:—-]*([\s\S]{100,2500}?)(?:\n\s*(?:\d\.?\s*)?(?:introduction|keywords|index terms)\b)/i.exec(text);
  return match?.[1].replace(/\s+/g, " ").trim();
}

export async function ingestPdfBytes(bytes: Uint8Array, source: string): Promise<Extracted> {
  const pdf = await parsePdf(bytes);
  if (!pdf.text) throw new Error(`No extractable text in ${source} (scanned PDFs need OCR first).`);
  const fallbackTitle = decodeURIComponent(source.split(/[\\/]/).pop() ?? source).replace(/\.pdf$/i, "");
  return {
    kind: "pdf",
    source,
    title: pdf.title ?? pdf.text.split("\n").find((l) => l.trim().length > 8)?.trim().slice(0, 150) ?? fallbackTitle,
    author: pdf.author,
    excerpt: findAbstract(pdf.text),
    content: pdf.text,
    meta: { pages: pdf.pages },
  };
}
