import type { Extracted } from "../types.js";
import { httpGet } from "../util.js";

const RESERVED = new Set([
  "about", "apps", "collections", "explore", "features", "marketplace", "orgs", "pricing",
  "settings", "sponsors", "topics", "trending", "login", "join", "notifications", "search",
]);

export interface RepoRef {
  owner: string;
  repo: string;
}

/** Only repository roots (optionally /tree/<branch>) are treated as repos; other GitHub pages are plain web pages. */
export function parseGitHubRepo(url: URL): RepoRef | undefined {
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return undefined;
  const [owner, repo, section] = url.pathname.split("/").filter(Boolean);
  if (!owner || !repo || RESERVED.has(owner)) return undefined;
  if (section && section !== "tree") return undefined;
  return { owner, repo: repo.replace(/\.git$/, "") };
}

function api(path: string, accept = "application/vnd.github+json") {
  const headers: Record<string, string> = { accept, "x-github-api-version": "2022-11-28" };
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  return httpGet(`https://api.github.com${path}`, headers);
}

export async function ingestGitHub({ owner, repo }: RepoRef): Promise<Extracted> {
  const base = `/repos/${owner}/${repo}`;
  const info = (await (await api(base)).json()) as any;
  const [languages, readme, tree] = await Promise.all([
    api(`${base}/languages`).then((r) => r.json() as Promise<Record<string, number>>).catch(() => ({})),
    api(`${base}/readme`, "application/vnd.github.raw").then((r) => r.text()).catch(() => ""),
    api(`${base}/contents`).then((r) => r.json() as Promise<any[]>).catch(() => []),
  ]);

  const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0) || 1;
  const langList = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .map(([name, bytes]) => `${name} (${((bytes / totalBytes) * 100).toFixed(1)}%)`);

  const structure = (Array.isArray(tree) ? tree : [])
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1))
    .map((e) => `${e.type === "dir" ? "📁" : "📄"} ${e.name}${e.type === "dir" ? "/" : ""}`);

  const content = [
    info.description ? `> ${info.description}` : "",
    "## Repository",
    [
      `- **Stars:** ${info.stargazers_count ?? 0} · **Forks:** ${info.forks_count ?? 0} · **Open issues:** ${info.open_issues_count ?? 0}`,
      info.license?.spdx_id ? `- **License:** ${info.license.spdx_id}` : "",
      info.homepage ? `- **Homepage:** ${info.homepage}` : "",
      `- **Default branch:** ${info.default_branch}`,
      `- **Last push:** ${info.pushed_at?.slice(0, 10)}`,
      langList.length ? `- **Languages:** ${langList.join(", ")}` : "",
    ].filter(Boolean).join("\n"),
    structure.length ? "## Top-level Structure\n\n```tree\n" + structure.join("\n") + "\n```" : "",
    readme ? `## README\n\n${readme.trim()}` : "_No README found._",
  ].filter(Boolean).join("\n\n");

  return {
    kind: "github",
    source: info.html_url ?? `https://github.com/${owner}/${repo}`,
    title: info.full_name ?? `${owner}/${repo}`,
    author: info.owner?.login ?? owner,
    published: info.created_at?.slice(0, 10),
    siteName: "GitHub",
    excerpt: info.description ?? undefined,
    content,
    meta: {
      stars: info.stargazers_count ?? 0,
      language: info.language ?? "",
      languages: Object.keys(languages),
      topics: info.topics ?? [],
      ...(info.license?.spdx_id ? { license: info.license.spdx_id } : {}),
    },
  };
}
