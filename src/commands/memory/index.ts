import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { log } from "../../lib/output.js";

function isMemoryInstalled(): boolean {
  const cwd = process.cwd();
  return hasMemoryHook(join(cwd, ".claude", "settings.json"))
    || hasMemoryHook(join(cwd, ".claude", "settings.local.json"));
}

function hasMemoryHook(path: string): boolean {
  try {
    const settings = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    const hooks = settings.hooks as Record<string, unknown[]> | undefined;
    if (!hooks) return false;
    const sessionStart = hooks.SessionStart as Record<string, unknown>[] | undefined;
    return sessionStart?.some((h) => {
      const inner = h.hooks as Record<string, unknown>[] | undefined;
      return inner?.some((ih) => String(ih.command ?? "").includes("memory context"));
    }) ?? false;
  } catch {
    return false;
  }
}

export function createMemoryCommand(): Command {
  const memory = new Command("memory")
    .description("Knowledge base that Claude maintains across sessions")
    .option("--dashboard", "Open the memory dashboard")
    .action(async (opts) => {
      if (opts.dashboard) {
        if (!isMemoryInstalled()) {
          log.error("Knowledge base not set up yet. Run `claude-launchpad memory` first.");
          return;
        }
        const { requireMemoryDeps } = await import("./utils/require-deps.js");
        await requireMemoryDeps();
        const { startTui } = await import("./dashboard/tui.js");
        await startTui();
        return;
      }

      // Smart default: install or show stats
      if (!isMemoryInstalled()) {
        // Check if config was already written (e.g. by doctor --fix) even though db isn't set up
        const { detectExistingSetup } = await import("./subcommands/install.js");
        const existing = detectExistingSetup(process.cwd());
        if (existing) {
          const location = existing === "local"
            ? ".claude/CLAUDE.md + settings.local.json"
            : "CLAUDE.md + settings.json";
          log.blank();
          log.success(`Memory config found (${location}) but database not set up.`);
          log.info("Run the install to complete setup.");
          log.blank();
        } else {
          log.blank();
          log.step("Claude doesn't have a knowledge base for this project yet.");
          log.blank();
          log.info("After setup, Claude will:");
          log.info("  - Remember decisions, gotchas, and learnings across sessions");
          log.info("  - Automatically recall relevant context when you start a session");
          log.info("  - Save important facts as you work, so nothing gets lost");
          log.blank();
        }

        const proceed = await confirm({
          message: "Set up knowledge base?",
          default: true,
        });

        if (!proceed) {
          log.info("Skipped.");
          return;
        }

        const { runInstall } = await import("./subcommands/install.js");
        await runInstall({});
      } else {
        const { requireMemoryDeps } = await import("./utils/require-deps.js");
        await requireMemoryDeps();
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
    new Command("serve")
      .description("Start MCP server (Claude Code)")
      .action(async () => {
        const { startServer } = await import("./server.js");
        await startServer();
      })
      .helpCommand(false),
    { hidden: true },
  );

  // User-facing sync commands
  memory.addCommand(
    new Command("push")
      .description("Push current project's memories to GitHub Gist")
      .option("--all", "Push all projects")
      .option("-y, --yes", "Skip confirmation prompt")
      .action(async (opts) => {
        const { runPush } = await import("./subcommands/push.js");
        await runPush(opts);
      }),
  );

  memory.addCommand(
    new Command("pull")
      .description("Pull current project's memories from GitHub Gist")
      .option("--all", "Pull all projects")
      .action(async (opts) => {
        const { runPull } = await import("./subcommands/pull.js");
        await runPull(opts);
      }),
  );

  memory.addCommand(
    new Command("purge")
      .description("Delete all memories for a project")
      .argument("<project>", "Project name to purge")
      .option("-y, --yes", "Skip confirmation prompt")
      .action(async (project, opts) => {
        const { runPurge } = await import("./subcommands/purge.js");
        await runPurge({ project, ...opts });
      }),
  );

  return memory;
}
