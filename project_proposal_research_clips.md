# Project Proposal: Research-Clips
> **Slogan:** Stop context switching. Clip, synthesize, and archive research directly from your workflow.

---

## 1. Project Overview & Motivation
As software developers and researchers, a significant portion of our daily workload involves consuming information—technical documentation, engineering blogs, GitHub repositories, PDF research papers, and forum discussions. 

**The Core Pain Point:**
* Manual copying and pasting into note-taking tools (Obsidian, Notion, Markdown files) breaks focus.
* Context-switching between browser windows and writing apps wastes valuable deep-work time.
* Saved articles often end up in a "read later" graveyard without actionable summaries or tags.

**The Solution:**
**Research-Clips** is a lightweight, high-performance developer tool (CLI + browser extension/local service) that ingests any article, GitHub repo, or research paper URL, strips the clutter, runs a fast AI synthesis, and automatically formats and vaults structured Markdown notes directly into your local knowledge base.

---

## 2. Key Features

1. **Multi-Source Ingestion Engine:**
   * **Web Pages / Articles:** Strips ads, navigation bars, and scripts, extracting pure reader text.
   * **GitHub Repositories:** Extracts key README sections, code structure, and primary tech stack details.
   * **PDF / ArXiv Papers:** Extracts abstracts, key findings, and methodologies automatically.

2. **Automated AI Synthesis (LLM-Powered):**
   * Generates a concise 3-bullet executive summary.
   * Extracts key takeaways, code snippets, and relevant tech/research tags.
   * Local LLM option (e.g., Ollama) for privacy and zero API cost, alongside support for OpenAI/Claude/Gemini APIs.

3. **Seamless Vault Integration:**
   * Converts all processed content into clean, standardized Markdown files.
   * Features customizable YAML frontmatter (author, source URL, date, auto-generated tags, summary).
   * Direct sync support for Obsidian, Notion, or local Git-backed Markdown vaults.

4. **Developer-First UX:**
   * **CLI-First Interface:** Quick terminal commands like `clip <url> --tag dev,ai`.
   * **Minimal Browser Extension / Bookmarklet:** One-click clipping directly from the web browser.

---

## 3. Tech Stack & Architecture

| Component | Technology / Tools |
| :--- | :--- |
| **CLI / Core Logic** | Node.js (TypeScript) / Go / Python (Fast & lightweight build) |
| **Web Scraping / Ingestion** | Puppeteer / Playwright / Readability.js |
| **AI / Summarization** | LangChain / Direct OpenAI API / Ollama (Local LLM) |
| **Output Format** | Standard Markdown + YAML Frontmatter |
| **Storage / Vault Integration** | Local File System (Obsidian-ready) / Webhooks for Notion API |

---

## 4. Workload Impact & Time Savings

* **80% Reduction in Note-Taking Overhead:** Eliminates manual formatting, tagging, and summarization tasks.
* **Zero Context-Switching:** Save and index research directly from terminal sessions or browser tabs in under 3 seconds.
* **Better Knowledge Retention:** Auto-tagged, structured notes make past research immediately searchable in local knowledge graphs.

---

## 5. GitHub Profile & Portfolio Value

Building and publishing this project demonstrates high-value engineering skills:
* **Tooling & Automation Focus:** Shows a "builder mindset"—identifying friction in real-world workflows and creating elegant developer utilities.
* **Modern AI Integration:** Demonstrates practical implementation of LLMs and structured data extraction rather than simple wrapper applications.
* **Open Source Utility:** Follows the open-source philosophy of developers like `@steipete`—clean, single-purpose CLI utilities with clear documentation, easy installation (`npm install -g` or `brew install`), and immediate utility for the global developer/researcher community.