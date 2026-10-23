import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { parse as parseYaml } from "yaml";
import { parseArxivId } from "../src/ingest/arxiv.js";
import { parseGitHubRepo } from "../src/ingest/github.js";
import { cleanPdfText, findAbstract } from "../src/ingest/pdf.js";
import { htmlToExtracted } from "../src/ingest/web.js";
import { synthesizeOffline } from "../src/synth/offline.js";
import { buildUserPrompt, parseSynthesis, synthesisJsonSchema } from "../src/synth/prompt.js";
import type { Clip, Extracted } from "../src/types.js";
import { mergeTags, slugify } from "../src/util.js";
import { renderMarkdown } from "../src/vault/markdown.js";
import { writeNote } from "../src/vault/writer.js";

const sampleDoc: Extracted = {
  kind: "web",
  source: "https://example.com/post",
  title: "Fast: Builds & Caches",
  author: "Ada",
  content: "# Intro\n\nNode.js is great. It runs JavaScript.\n\n```ts\nconst a = 1;\nconst b = 2;\n```",
  meta: {},
};

test("slugify and tag normalization", () => {
  assert.equal(slugify("Fast: Builds & Caches — 2026!"), "fast-builds-caches-2026");
  assert.equal(slugify("???"), "clip");
  assert.deepEqual(mergeTags(["#Dev", "AI Tools"], ["dev", "ai-tools", ""]), ["dev", "ai-tools"]);
});

test("source routing", () => {
  assert.equal(parseArxivId(new URL("https://arxiv.org/abs/1706.03762v7")), "1706.03762v7");
  assert.equal(parseArxivId(new URL("https://arxiv.org/pdf/2401.00001.pdf")), "2401.00001");
  assert.equal(parseArxivId(new URL("https://arxiv.org/abs/cs/0101001")), "cs/0101001");
  assert.equal(parseArxivId(new URL("https://example.com/abs/1")), undefined);

  assert.deepEqual(parseGitHubRepo(new URL("https://github.com/nodejs/node")), { owner: "nodejs", repo: "node" });
  assert.deepEqual(parseGitHubRepo(new URL("https://github.com/a/b.git")), { owner: "a", repo: "b" });
  assert.ok(parseGitHubRepo(new URL("https://github.com/a/b/tree/main")));
  assert.equal(parseGitHubRepo(new URL("https://github.com/a/b/issues/1")), undefined);
  assert.equal(parseGitHubRepo(new URL("https://github.com/topics/ai")), undefined);
});

test("web extraction strips chrome and keeps fenced code", () => {
  const html = `<html><head><title>T</title><meta name="author" content="Grace"></head><body>
    <nav>Home | About | Login</nav>
    <article><h1>Real Title</h1>
      <p>${"Readable paragraph text about compilers. ".repeat(20)}</p>
      <pre><code class="language-rust">fn main() {}</code></pre>
    </article><script>track()</script><footer>© ads</footer></body></html>`;
  const doc = htmlToExtracted(html, "https://blog.example.com/x");
  assert.match(doc.content, /```rust\nfn main\(\) \{\}\n```/);
  assert.doesNotMatch(doc.content, /track\(\)|Login/);
  assert.equal(doc.author, "Grace");
});

test("pdf text cleanup and abstract detection", () => {
  assert.equal(cleanPdfText("trans-\nformer   models\n\n\n\nend"), "transformer models\n\nend");
  const text = "Title\nAbstract. " + "We study things carefully. ".repeat(10) + "\n1 Introduction\nBody";
  assert.match(findAbstract(text)!, /^We study things/);
});

test("JSON schema is strict for OpenAI-style structured outputs", () => {
  const schema = synthesisJsonSchema() as any;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required.sort(), ["snippets", "summary", "tags", "takeaways"]);
  assert.equal(schema.properties.snippets.items.additionalProperties, false);
  assert.equal(schema.$schema, undefined);
});

test("parseSynthesis tolerates code fences and validates shape", () => {
  const raw = '```json\n{"summary":["a"],"takeaways":[],"snippets":[],"tags":["x"]}\n```';
  assert.deepEqual(parseSynthesis(raw).tags, ["x"]);
  assert.throws(() => parseSynthesis('{"summary":"nope"}'));
});

test("prompt truncation is reported", () => {
  const { prompt, truncated } = buildUserPrompt({ ...sampleDoc, content: "x".repeat(100) }, 10);
  assert.ok(truncated);
  assert.match(prompt, /\[\.\.\.truncated\.\.\.\]/);
});

test("offline synthesis keeps dotted words intact", () => {
  const s = synthesizeOffline({ ...sampleDoc, excerpt: "Node.js® is a runtime for servers and tools. It is fast and widely used." });
  assert.match(s.summary[0], /^Node\.js® is a runtime/);
  assert.equal(s.snippets[0].language, "ts");
});

test("markdown rendering + collision-safe writes", () => {
  const clip: Clip = {
    extracted: sampleDoc,
    synthesis: { summary: ["One.", "Two.", "Three."], takeaways: ["Do X"], snippets: [], tags: ["build"] },
    tags: ["dev", "build"],
    clippedAt: new Date("2026-01-02T03:04:05Z"),
    provider: "anthropic",
    model: "claude-opus-5-5",
  };
  const md = renderMarkdown(clip, { includeContent: true, extraFrontmatter: { status: "inbox" } });
  const fm = parseYaml(md.split("---")[1]);
  assert.equal(fm.title, "Fast: Builds & Caches");
  assert.deepEqual(fm.tags, ["dev", "build"]);
  assert.equal(fm.status, "inbox");
  assert.equal(fm.synthesized_by, "anthropic/claude-opus-5-5");
  assert.match(md, /> \[!summary\] Executive Summary\n> - One\./);
  assert.match(md, /## Content\n\n### Intro/); // source headings are demoted

  const dir = mkdtempSync(join(tmpdir(), "rc-"));
  const a = writeNote(dir, "note.md", "a");
  const b = writeNote(dir, "note.md", "b");
  assert.notEqual(a, b);
  assert.equal(readFileSync(a, "utf8"), "a");
});
