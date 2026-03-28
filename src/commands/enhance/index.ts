import { Command } from "commander";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { printBanner, log } from "../../lib/output.js";

const execAsync = promisify(execFile);

const ENHANCE_PROMPT = `Read CLAUDE.md and the project's codebase, then update CLAUDE.md to fill in missing or incomplete sections.

CRITICAL BUDGET RULE: CLAUDE.md must stay UNDER 120 lines of actionable content (not counting headings, blank lines, or comments). Claude Code starts ignoring rules past ~150 instructions. If you need more detail, create .claude/rules/ files instead:
- Create .claude/rules/conventions.md for detailed coding patterns
- Create .claude/rules/architecture.md for detailed structure docs
- Keep CLAUDE.md to HIGH-LEVEL summaries only (3-5 bullets per section max)

Sections to fill in or preserve (DO NOT remove any existing section):
1. **## Stack** — if missing or incomplete, detect and add language, framework, package manager
2. **## Architecture** — 3-5 bullet points describing the codebase shape (not a full directory tree)
3. **## Conventions** — max 8 key patterns. Move detailed rules to .claude/rules/conventions.md
4. **## Off-Limits** — max 8 guardrails specific to this project
5. **## Key Decisions** — only decisions that affect how Claude should work in this codebase
6. **MCP server suggestions** — look at what external services the project uses (databases, APIs, storage). If you spot Postgres, Redis, Stripe, GitHub API, or similar, suggest relevant MCP servers the user could add. Print these as suggestions at the end, not in CLAUDE.md.

Also review .claude/settings.json hooks:
- Read the existing hooks in .claude/settings.json
- If you see project-specific patterns that deserve hooks (e.g., protected directories, test file patterns, migration files), suggest adding them
- DO NOT overwrite existing hooks — only add new ones that are specific to this project
- Print hook suggestions at the end with the exact JSON to add, don't modify settings.json directly

Rules:
- Don't remove existing content — only add or improve
- Be specific to THIS project, not generic advice
- Use bullet points, not paragraphs
- If a section would exceed 8 bullets, split into a .claude/rules/ file and reference it
- After editing, count the actionable lines. If over 120, move content to rules files until under`;

export function createEnhanceCommand(): Command {
  return new Command("enhance")
    .description("Use Claude to analyze your codebase and complete CLAUDE.md")
    .option("-p, --path <path>", "Project root path", process.cwd())
    .action(async (opts) => {
      printBanner();

      const root = opts.path;

      // Check CLAUDE.md exists
      const claudeMdPath = join(root, "CLAUDE.md");
      try {
        await access(claudeMdPath);
      } catch {
        log.error("No CLAUDE.md found. Run `claude-launchpad init` first.");
        process.exit(1);
      }

      // Check Claude CLI is available
      try {
        await execAsync("claude", ["--version"]);
      } catch {
        log.error("Claude CLI not found. Install it: https://docs.anthropic.com/en/docs/claude-code");
        process.exit(1);
      }

      log.step("Launching Claude to enhance your CLAUDE.md...");
      log.blank();

      const child = spawn(
        "claude",
        [ENHANCE_PROMPT],
        { cwd: root, stdio: "inherit" },
      );

      await new Promise<number>((resolve) => {
        child.on("close", (code) => resolve(code ?? 0));
      });

      log.blank();
      log.success("Run `claude-launchpad doctor` to check your updated score.");
    });
}
