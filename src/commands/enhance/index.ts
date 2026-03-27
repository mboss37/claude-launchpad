import { Command } from "commander";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { printBanner, log } from "../../lib/output.js";

const execAsync = promisify(execFile);

const ENHANCE_PROMPT = `Read CLAUDE.md and the project's codebase, then update CLAUDE.md to fill in missing or incomplete sections:

1. **## Architecture** or **## Project Structure** — describe the actual codebase structure (directories, key files, data flow)
2. **## Conventions** — add project-specific patterns you observe (naming, imports, state management, API patterns)
3. **## Off-Limits** — add guardrails based on what you see (protected files, patterns to avoid, things that should never change)
4. **## Key Decisions** — document any architectural decisions visible in the code

Rules:
- Keep CLAUDE.md under 150 instructions (lines of actionable content)
- Don't remove existing content — only add or improve
- Be specific to THIS project, not generic advice
- Use bullet points, not paragraphs`;

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
