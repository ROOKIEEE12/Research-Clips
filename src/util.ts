export const USER_AGENT =
  "Mozilla/5.0 (compatible; research-clips/0.1; +https://github.com/research-clips/research-clips)";

export async function httpGet(url: string | URL, headers: Record<string, string> = {}, timeoutMs = 30_000) {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status} ${res.statusText}`);
  return res;
}

export function slugify(text: string, maxLength = 60): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (slug.slice(0, maxLength).replace(/-+$/, "") || "clip");
}

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function mergeTags(...lists: string[][]): string[] {
  const out = new Set<string>();
  for (const list of lists) for (const t of list) {
    const n = normalizeTag(t);
    if (n) out.add(n);
  }
  return [...out];
}

export function log(message: string) {
  process.stderr.write(`\x1b[2m›\x1b[0m ${message}\n`);
}

export function warn(message: string) {
  process.stderr.write(`\x1b[33m!\x1b[0m ${message}\n`);
}
