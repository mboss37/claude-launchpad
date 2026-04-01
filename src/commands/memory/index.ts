import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { log } from "../../lib/output.js";

function isMemoryInstalled(): boolean {
  const dbPath = join(homedir(), ".agentic-memory", "memory.db");
  return existsSync(dbPath);
}

export function createMemoryCommand(): Command {
  const memory = new Command("memory")
    .description("Persistent memory system for Claude Code sessions")
    .option("--dashboard", "Open the memory dashboard")
    .action(async (opts) => {
      if (opts.dashboard) {
        if (!isMemoryInstalled()) {
          log.error("Memory system is not installed. Run `claude-launchpad memory` first.");
          return;
        }
        const { runStats } = await import("./subcommands/stats.js");
        await runStats({});
        return;
      }

      // Smart default: install or show stats
      if (!isMemoryInstalled()) {
        log.blank();
        log.step("Memory system is not set up.");
        log.blank();
        log.info("This will:");
        log.info("  - Create a SQLite database at ~/.agentic-memory/");
        log.info("  - Add SessionStart + Stop hooks to .claude/settings.json");
        log.info("  - Register the MCP server with Claude Code");
        log.info("  - Add memory guidance to CLAUDE.md");
        log.blank();

        const proceed = await confirm({
          message: "Install agentic-memory?",
          default: true,
        });

        if (!proceed) {
          log.info("Skipped.");
          return;
        }

        const { runInstall } = await import("./subcommands/install.js");
        await runInstall({});
      } else {
        const { runStats } = await import("./subcommands/stats.js");
        await runStats({});
      }
    });

  // Hidden internal commands (used by hooks and MCP, not user-facing)
  memory.addCommand(
    new Command("context")
      .description("Load session context (hook handler)")
      .option("--json", "JSON output")
      .action(async (opts) => {
        const { runContext } = await import("./subcommands/context.js");
        await runContext(opts);
      })
      .helpCommand(false),
    { hidden: true },
  );

  memory.addCommand(
    new Command("extract")
      .description("Extract facts from transcript (hook handler)")
      .action(async () => {
        const { runExtract } = await import("./subcommands/extract.js");
        await runExtract();
      })
      .helpCommand(false),
    { hidden: true },
  );

  memory.addCommand(
    new Command("serve")
      .description("Start MCP server (Claude Code)")
      .action(async () => {
        const { startServer } = await import("./server.js");
        await startServer();
      })
      .helpCommand(false),
    { hidden: true },
  );

  return memory;
}
