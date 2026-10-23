import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { configPath, type Config } from "./config.js";
import { runClip } from "./pipeline.js";
import { log, warn } from "./util.js";

/** A per-machine secret so random web pages can't trigger clips through the local server. */
function loadToken(): string {
  const path = join(dirname(configPath()), "server-token");
  if (existsSync(path)) return readFileSync(path, "utf8").trim();
  const token = randomBytes(18).toString("base64url");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, token, { encoding: "utf8", mode: 0o600 });
  return token;
}

export function bookmarklet(port: number, token: string): string {
  const js = `(()=>{const t=prompt('Research-Clips tags (comma separated)','');if(t===null)return;window.open('http://127.0.0.1:${port}/clip?token=${token}&url='+encodeURIComponent(location.href)+'&tags='+encodeURIComponent(t),'research-clips','width=520,height=360')})()`;
  return `javascript:${encodeURIComponent(js)}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const page = (title: string, body: string) => `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font:15px/1.5 system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#1d1d1f;background:#fafafa}
@media(prefers-color-scheme:dark){body{color:#e8e8e8;background:#161616}a{color:#8ab4ff}}
code{background:rgba(127,127,127,.15);padding:2px 5px;border-radius:4px;word-break:break-all}
.bm{display:inline-block;padding:8px 14px;border-radius:8px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600}
li{margin:4px 0}</style>${body}`;

function send(res: ServerResponse, status: number, type: string, body: string) {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" });
  res.end(body);
}

function authorized(given: string | null, token: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export function startServer(config: Config, port = config.port) {
  const token = loadToken();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    try {
      if (req.method === "GET" && url.pathname === "/") {
        return send(res, 200, "text/html", page("Research-Clips", `<h1>📎 Research-Clips</h1>
<p>Drag this button to your bookmarks bar, then click it on any page to clip it:</p>
<p><a class="bm" href="${esc(bookmarklet(port, token))}">📎 Clip</a></p>
<p>Notes are saved to <code>${esc(join(config.vault, config.folder))}</code> using <code>${esc(config.provider)}</code>.</p>
<p>API: <code>POST /api/clip</code> with header <code>x-clip-token</code> and body <code>{"url": "...", "tags": ["..."]}</code>.</p>`));
      }

      if (req.method === "GET" && url.pathname === "/clip") {
        if (!authorized(url.searchParams.get("token"), token)) return send(res, 401, "text/html", page("Unauthorized", "<h1>Invalid token</h1><p>Re-copy the bookmarklet from the server home page.</p>"));
        const source = url.searchParams.get("url");
        if (!source) return send(res, 400, "text/html", page("Missing URL", "<h1>Missing url parameter</h1>"));
        const tags = (url.searchParams.get("tags") ?? "").split(",").filter(Boolean);
        const result = await runClip(source, config, { tags });
        log(`Saved ${result.path}`);
        return send(res, 200, "text/html", page("Clipped ✓", `<h1>✓ Clipped in ${(result.ms / 1000).toFixed(1)}s</h1>
<p><strong>${esc(result.clip.extracted.title)}</strong></p>
<ul>${result.clip.synthesis.summary.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
<p>Tags: ${result.clip.tags.map((t) => `<code>#${esc(t)}</code>`).join(" ")}</p>
<p>Saved to <code>${esc(result.path!)}</code></p><script>setTimeout(()=>window.close(),8000)</script>`));
      }

      if (req.method === "POST" && url.pathname === "/api/clip") {
        if (!authorized(req.headers["x-clip-token"] as string ?? null, token)) return send(res, 401, "application/json", '{"error":"invalid token"}');
        const body = await readJson(req);
        if (typeof body.url !== "string") return send(res, 400, "application/json", '{"error":"url is required"}');
        const result = await runClip(body.url, config, { tags: Array.isArray(body.tags) ? body.tags : [] });
        return send(res, 200, "application/json", JSON.stringify({
          path: result.path, title: result.clip.extracted.title, tags: result.clip.tags, summary: result.clip.synthesis.summary, ms: result.ms,
        }));
      }

      send(res, 404, "text/plain", "Not found");
    } catch (err) {
      const message = (err as Error).message;
      warn(message);
      if (url.pathname.startsWith("/api/")) send(res, 500, "application/json", JSON.stringify({ error: message }));
      else send(res, 500, "text/html", page("Clip failed", `<h1>Clip failed</h1><p>${esc(message)}</p>`));
    }
  });

  server.listen(port, "127.0.0.1", () => {
    log(`Research-Clips server on http://127.0.0.1:${port} — open it to install the bookmarklet`);
  });
  return server;
}
