# 📎 Research-Clips

> Stop context switching. Clip, synthesize, and archive research directly from your workflow.

`clip` takes a URL or a local file — an article, a GitHub repo, an arXiv paper or any PDF — strips the clutter, asks an LLM for a structured synthesis, and saves a clean Markdown note with YAML frontmatter straight into your Obsidian (or any Markdown) vault.

```bash
clip https://arxiv.org/abs/1706.03762 --tag ml,transformers
```

```
› Extracted arxiv: "Attention Is All You Need" (40,738 chars)
› Synthesizing with anthropic/claude-opus-5-5
✓ Attention Is All You Need (2.8s)
  • Introduces the Transformer, an encoder-decoder built entirely on attention…
  • …
  #ml #transformers #attention #nlp #cs-cl
~/ResearchClips/Clips/2026-10-23-attention-is-all-you-need.md
```

## Features

- **Multi-source ingestion**
  - **Web pages:** Mozilla Readability strips nav, ads and scripts; code blocks keep their language. `--render` uses Playwright for JavaScript-heavy sites.
  - **GitHub repos:** description, stars, license, language breakdown, top-level structure and the README, taken from the GitHub API.
  - **arXiv:** metadata and abstract from the arXiv API, plus the full PDF text.
  - **PDFs:** any `.pdf` URL or local file, with best-effort abstract detection.
  - **Local files:** `.pdf`, `.html` and `.md`/`.txt`.
- **AI synthesis:** a 3-bullet executive summary, key takeaways, code snippets copied verbatim from the source, and auto-tags. Output is schema-validated for every provider.
  - `anthropic` (default, `claude-opus-5-5`) · `openai` · `gemini` · `ollama` (local, private, free) · `none` (offline heuristics, no LLM)
- **Vault integration:** Obsidian-ready Markdown with a `[!summary]` callout and standardized frontmatter, plus your own static fields. Existing notes are never overwritten. Optional **git auto-commit** and a **webhook** for Notion (via Make, Zapier or n8n), Slack or your own indexer.
- **Developer-first UX:** a CLI that takes many sources at once, `--json` output for scripting, and a **bookmarklet** served by `clip serve` for one-click clipping from the browser.

## Install

```bash
git clone <this repo> && cd research-clips
npm install && npm run build
npm link            # puts `clip` on your PATH
```

Requires Node.js 20+.

## Setup

```bash
clip init --vault ~/Documents/Obsidian/MyVault --folder "Research/Clips" --provider anthropic
```

Then set credentials for the provider you chose:

| Provider | Credentials | Default model |
| :-- | :-- | :-- |
| `anthropic` | `ANTHROPIC_API_KEY` (or `ant auth login`) | `claude-opus-5-5` |
| `openai` | `OPENAI_API_KEY` (`OPENAI_BASE_URL` optional) | `gpt-4.1-mini` |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.5-flash` |
| `ollama` | none. Run `ollama serve` and `ollama pull llama3.2` | `llama3.2` |
| `none` | none | — |

Set `GITHUB_TOKEN` to avoid GitHub's unauthenticated rate limit (60 requests/hour).

## Usage

```bash
clip <url-or-file...> [options]

  -t, --tag <tags>        comma-separated tags (repeatable)
  -p, --provider <name>   anthropic | openai | gemini | ollama | none
  -m, --model <id>        model override
  -v, --vault <dir>       vault directory (overrides config)
  -f, --folder <name>     sub-folder inside the vault
      --render            render JS-heavy pages with Playwright first
      --no-content        keep only the synthesis, not the full text
      --git               commit the note if the vault is a git repo
      --dry-run           print the note instead of saving it
      --json              machine-readable result on stdout

clip init               create ~/.research-clips/config.json
clip config             show the effective config
clip serve [--port n]   local server + bookmarklet (default port 7777)
```

Examples:

```bash
clip https://github.com/sindresorhus/slugify -t tools
clip ./papers/raft.pdf -p ollama -m qwen2.5:14b
clip https://blog.example.com/post --dry-run -p none | less
clip $(cat reading-list.txt) --git
```

### Browser bookmarklet

```bash
clip serve
```

Open <http://127.0.0.1:7777> and drag the **📎 Clip** button to your bookmarks bar. On any page, click it, enter tags, and the note is saved a few seconds later. The server listens only on `127.0.0.1`. Requests must carry a per-machine token (stored in `~/.research-clips/server-token`), so other websites can't trigger clips.

Extensions and scripts can call the JSON API:

```bash
curl -X POST http://127.0.0.1:7777/api/clip \
  -H "x-clip-token: $(cat ~/.research-clips/server-token)" \
  -H "content-type: application/json" \
  -d '{"url":"https://example.com/post","tags":["inbox"]}'
```

## Configuration

`~/.research-clips/config.json` (override the path with `RESEARCH_CLIPS_CONFIG`):

```json
{
  "vault": "~/Documents/Obsidian/MyVault",
  "folder": "Research/Clips",
  "provider": "anthropic",
  "model": "claude-opus-5-5",
  "ollamaUrl": "http://127.0.0.1:11434",
  "includeContent": true,
  "git": false,
  "webhook": "https://hook.eu1.make.com/…",
  "frontmatter": { "status": "inbox" },
  "maxInputChars": 400000,
  "port": 7777
}
```

The env vars `RESEARCH_CLIPS_VAULT` and `RESEARCH_CLIPS_PROVIDER` override the file. When a source is longer than `maxInputChars`, only the beginning is sent to the LLM, and `clip` prints a warning. The full text is still saved in the note. The defaults are sized to each provider's context window; Ollama's is conservative.

## Output format

```markdown
---
title: Attention Is All You Need
source: https://arxiv.org/abs/1706.03762
type: arxiv
author: Ashish Vaswani, Noam Shazeer, …
published: 2017-06-12
clipped: 2026-10-23T13:12:00.000Z
tags: [ml, transformers, attention, nlp]
summary: Introduces the Transformer… 
arxiv_id: 1706.03762
categories: [cs.CL, cs.LG]
synthesized_by: anthropic/claude-opus-5-5
---

# Attention Is All You Need

> [!summary] Executive Summary
> - …

## Key Takeaways
## Code Snippets
## Content
```

The webhook receives `{ frontmatter, synthesis, markdown, path }` as JSON.

## Development

```bash
npm run dev -- <url> -p none   # run from source with tsx
npm test                       # unit tests (node:test)
npm run typecheck
```

```
src/
  cli.ts              commander entry point
  pipeline.ts         ingest → synthesize → render → write
  ingest/             web, github, arxiv, pdf, local files
  synth/              prompt + schema, one file per provider
  vault/              markdown rendering, writer, git, webhook
  server.ts           bookmarklet server + JSON API
```

## Roadmap

- Native Notion API sync (today: webhook)
- Browser extension wrapping the JSON API
- YouTube transcripts and Hacker News threads as sources
- `clip search` over the vault's frontmatter

## License

MIT
