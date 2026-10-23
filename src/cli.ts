#!/usr/bin/env node
import { Command, Option } from "commander";
import { configPath, DEFAULTS, loadConfig, writeConfig } from "./config.js";
import { runClip } from "./pipeline.js";
import { startServer } from "./server.js";
import { PROVIDERS } from "./synth/index.js";
import type { ProviderName } from "./types.js";

const program = new Command();

program
  .name("clip")
  .description("Clip, synthesize, and archive research (articles, GitHub repos, PDFs, arXiv) into Markdown notes.")
  .version("0.1.0")
  .argument("[sources...]", "URLs or local files (.pdf, .html, .md) to clip")
  .option("-t, --tag <tags>", "comma-separated tags to add", (v, prev: string[] = []) => prev.concat(v.split(",")))
  .addOption(new Option("-p, --provider <name>", "LLM provider").choices(PROVIDERS))
  .option("-m, --model <id>", "model override for the provider")
  .option("-v, --vault <dir>", "vault directory (overrides config)")
  .option("-f, --folder <name>", "sub-folder inside the vault")
  .option("--render", "render JavaScript-heavy pages with Playwright before extracting")
  .option("--no-content", "omit the full extracted text from the note")
  .option("--git", "commit the note if the vault is a git repo")
  .option("--dry-run", "print the note to stdout instead of saving it")
  .option("--json", "print a JSON result (path, title, tags, summary) to stdout")
  .action(async (sources: string[], opts) => {
    if (!sources.length) return program.help();
    const config = loadConfig();
    if (opts.vault) config.vault = opts.vault;

    let failed = 0;
    for (const source of sources) {
      try {
        const result = await runClip(source, config, {
          tags: opts.tag,
          provider: opts.provider as ProviderName | undefined,
          model: opts.model,
          folder: opts.folder,
          render: opts.render,
          includeContent: opts.content,
          git: opts.git,
          dryRun: opts.dryRun,
          quiet: opts.json,
        });
        if (opts.dryRun) process.stdout.write(result.markdown);
        else if (opts.json) {
          console.log(JSON.stringify({
            path: result.path, title: result.clip.extracted.title, tags: result.clip.tags,
            summary: result.clip.synthesis.summary, ms: result.ms,
          }));
        } else {
          console.error(`\x1b[32m✓\x1b[0m ${result.clip.extracted.title} \x1b[2m(${(result.ms / 1000).toFixed(1)}s)\x1b[0m`);
          for (const s of result.clip.synthesis.summary) console.error(`  • ${s}`);
          console.error(`  \x1b[2m${result.clip.tags.map((t) => "#" + t).join(" ")}\x1b[0m`);
          console.log(result.path);
        }
      } catch (err) {
        failed++;
        console.error(`\x1b[31m✗\x1b[0m ${source}: ${(err as Error).message}`);
      }
    }
    process.exitCode = failed ? 1 : 0;
  });

program
  .command("init")
  .description("create a config file")
  .option("-v, --vault <dir>", "vault directory", DEFAULTS.vault)
  .addOption(new Option("-p, --provider <name>", "default LLM provider").choices(PROVIDERS).default(DEFAULTS.provider))
  .option("-m, --model <id>", "default model")
  .option("-f, --folder <name>", "sub-folder for clips", DEFAULTS.folder)
  .option("--git", "auto-commit clips to the vault git repo")
  .option("--webhook <url>", "POST every clip to this URL")
  .action((opts) => {
    const path = writeConfig({
      vault: opts.vault,
      folder: opts.folder,
      provider: opts.provider,
      ...(opts.model ? { model: opts.model } : {}),
      git: Boolean(opts.git),
      ...(opts.webhook ? { webhook: opts.webhook } : {}),
      includeContent: true,
      frontmatter: {},
    });
    console.log(`Wrote ${path}`);
  });

program
  .command("config")
  .description("show the effective configuration")
  .action(() => {
    console.log(`# ${configPath()}`);
    console.log(JSON.stringify(loadConfig(), null, 2));
  });

program
  .command("serve")
  .description("run a local server for the browser bookmarklet")
  .option("--port <n>", "port to listen on", (v) => Number.parseInt(v, 10))
  .action((opts) => {
    const config = loadConfig();
    startServer(config, opts.port ?? config.port);
  });

program.parseAsync().catch((err) => {
  console.error(`\x1b[31m✗\x1b[0m ${(err as Error).message}`);
  process.exit(1);
});
