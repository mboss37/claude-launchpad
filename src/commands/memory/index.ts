import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import { log } from "../../lib/output.js";

async function handleSyncErrors(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    log.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

/**
 * Memory is "installed" when BOTH:
 * (1) the SessionStart context hook is present in project settings
 * (2) the agentic-memory MCP server is registered in project (.mcp.json),
 *     local (settings.local.json), or user scope (~/.claude.json)
 * Missing either half means the setup is half-broken (hooks fire but no tools, or tools present but no context injection).
 */
export function isMemoryInstalled(): boolean {
  const cwd = process.cwd();
  const hookPresent = hasMemoryHook(join(cwd, ".claude", "settings.json"))
    || hasMemoryHook(join(cwd, ".claude", "settings.local.json"));
  if (!hookPresent) return false;
  return isMemoryMcpRegistered(cwd);
}

export function isMemoryMcpRegistered(projectRoot: string): boolean {
  return hasMemoryServerInJson(join(projectRoot, ".mcp.json"), "mcpServers")
    || hasMemoryServerInJson(join(projectRoot, ".claude", "settings.local.json"), "mcpServers")
    || hasMemoryServerInUserConfig(projectRoot);
}

function hasMemoryServerInJson(path: string, key: string): boolean {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    const servers = parsed[key] as Record<string, unknown> | undefined;
    return !!servers && typeof servers === "object" && "agentic-memory" in servers;
  } catch {
    return false;
  }
}

function hasMemoryServerInUserConfig(projectRoot: string): boolean {
  try {
    const parsed = JSON.parse(readFileSync(join(homedir(), ".claude.json"), "utf-8")) as Record<string, unknown>;
    // User-scope registration lives under projects[projectRoot].mcpServers
    const projects = parsed.projects as Record<string, unknown> | undefined;
    const project = projects?.[projectRoot] as Record<string, unknown> | undefined;
    const scoped = project?.mcpServers as Record<string, unknown> | undefined;
    if (scoped && "agentic-memory" in scoped) return true;
    // Global user scope (~/.claude.json top-level mcpServers, if Claude Code ever uses it)
    const global = parsed.mcpServers as Record<string, unknown> | undefined;
    return !!global && "agentic-memory" in global;
  } catch {
    return false;
  }
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
    .description("Project-scoped memory with decay, sync, and a TUI dashboard")
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
        const mcpMissing = existing !== null && !isMemoryMcpRegistered(process.cwd());
        if (existing) {
          const location = existing === "local"
            ? ".claude/CLAUDE.md + settings.local.json"
            : "CLAUDE.md + settings.json";
          log.blank();
          log.success(`Memory config found (${location}) but ${mcpMissing ? "MCP server not registered" : "database not set up"}.`);
          log.info("Run `claude-launchpad memory install` to complete setup.");
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

  // Explicit install subcommand — always re-runs the flow.
  // Use when `memory` detects a half-broken state (hook OK, MCP missing, etc.) or after a purge.
  memory.addCommand(
    new Command("install")
      .description("Install (or re-install) the knowledge base for this project")
      .option("--db-path <path>", "Override the default data directory")
      .action(async (opts) => {
        const { runInstall } = await import("./subcommands/install.js");
        await runInstall(opts.dbPath ? { dbPath: opts.dbPath } : {});
      }),
  );

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
        await handleSyncErrors(async () => {
          const { runPush } = await import("./subcommands/push.js");
          await runPush(opts);
        });
      }),
  );

  memory.addCommand(
    new Command("pull")
      .description("Pull current project's memories from GitHub Gist")
      .option("--all", "Pull all projects")
      .option("-y, --yes", "Non-interactive (accepted for symmetry with push; pull never prompts)")
      .action(async (opts) => {
        await handleSyncErrors(async () => {
          const { runPull } = await import("./subcommands/pull.js");
          await runPull(opts);
        });
      }),
  );

  // Sync management commands
  const sync = new Command("sync")
    .description("Manage memory sync");

  sync.addCommand(
    new Command("status")
      .description("Show local vs remote memory counts per project")
      .action(async () => {
        await handleSyncErrors(async () => {
          const { runSyncStatus } = await import("./subcommands/sync-status.js");
          await runSyncStatus();
        });
      }),
  );

  sync.addCommand(
    new Command("clean")
      .description("Remove a project from the sync gist")
      .argument("<project>", "Project slug to remove")
      .option("-y, --yes", "Skip confirmation prompt")
      .action(async (project: string, opts) => {
        await handleSyncErrors(async () => {
          const { runSyncClean } = await import("./subcommands/sync-clean.js");
          await runSyncClean(project, opts);
        });
      }),
  );

  memory.addCommand(sync);

  return memory;
}
