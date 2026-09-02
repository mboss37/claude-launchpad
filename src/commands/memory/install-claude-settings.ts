import {
  readSettingsJson,
  writeSettingsJson,
  readSettingsLocalJson,
  writeSettingsLocalJson,
} from "../../lib/settings.js";
import { addOrUpdateHook } from "../../lib/hook-builder.js";
import { log } from "../../lib/output.js";
import type { MemoryPlacement } from "../../types/index.js";

export async function configureClaudeMemorySettings(
  projectDir: string,
  placement: MemoryPlacement,
): Promise<void> {
  const read = placement === "local" ? readSettingsLocalJson : readSettingsJson;
  const write =
    placement === "local" ? writeSettingsLocalJson : writeSettingsJson;
  const settings = await read(projectDir);
  if (settings === null) {
    throw new Error(
      "settings.json is unreadable; repair or remove it before installing memory.",
    );
  }

  log.info("Built-in auto-memory disabled (replaced by knowledge base)");
  const baseHooks = (settings["hooks"] ?? {}) as Record<string, unknown[]>;
  const updated = {
    ...addToolPermissions(settings),
    autoMemoryEnabled: false,
    hooks: addSessionEndPushHook(
      addSessionStartHook(addSessionStartPullHook(baseHooks)),
    ),
  };
  await write(projectDir, updated);
  const target =
    placement === "local" ? "settings.local.json" : "settings.json";
  log.success(`Claude Code configured in ${target}`);
}

function addSessionStartPullHook(
  hooks: Record<string, unknown[]>,
): Record<string, unknown[]> {
  const result = addOrUpdateHook(hooks, {
    event: "SessionStart",
    dedupKeyword: "memory pull",
    entry: {
      matcher: "startup",
      hooks: [
        {
          type: "command",
          command: "npx claude-launchpad memory pull -y 2>/dev/null; exit 0",
        },
      ],
    },
    prepend: true,
  });
  if (result.added) {
    log.info("Session start: memories will auto-pull from GitHub Gist");
  }
  return result.hooks;
}

function addSessionStartHook(
  hooks: Record<string, unknown[]>,
): Record<string, unknown[]> {
  const result = addOrUpdateHook(hooks, {
    event: "SessionStart",
    dedupKeyword: "claude-launchpad memory context",
    entry: {
      matcher: "startup|resume",
      hooks: [
        {
          type: "command",
          command:
            "npx claude-launchpad memory context --json 2>/dev/null; exit 0",
        },
      ],
    },
  });
  if (result.added) {
    log.info(
      "Session start: Claude will recall relevant context automatically",
    );
  }
  return result.hooks;
}

function addSessionEndPushHook(
  hooks: Record<string, unknown[]>,
): Record<string, unknown[]> {
  const result = addOrUpdateHook(hooks, {
    event: "SessionEnd",
    dedupKeyword: "memory push",
    entry: {
      hooks: [
        {
          type: "command",
          command: "npx claude-launchpad memory push -y",
          async: true,
        },
      ],
    },
  });
  if (result.added) {
    log.info("Session end: memories will auto-push to GitHub Gist");
  }
  return result.hooks;
}

function addToolPermissions(
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const permissions = (settings["permissions"] ?? {}) as Record<
    string,
    unknown
  >;
  const allowList = (permissions["allow"] ?? []) as readonly string[];
  const memoryTools = [
    "mcp__agentic-memory__memory_store",
    "mcp__agentic-memory__memory_search",
    "mcp__agentic-memory__memory_recent",
    "mcp__agentic-memory__memory_forget",
    "mcp__agentic-memory__memory_relate",
    "mcp__agentic-memory__memory_stats",
    "mcp__agentic-memory__memory_update",
  ];
  const missing = memoryTools.filter((tool) => !allowList.includes(tool));
  if (missing.length === 0) return settings;
  log.info(`${missing.length} memory tools auto-approved`);
  return {
    ...settings,
    permissions: { ...permissions, allow: [...allowList, ...missing] },
  };
}
