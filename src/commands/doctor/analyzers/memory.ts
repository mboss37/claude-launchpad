import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";
import { readSyncConfig } from "../../memory/utils/gist-transport.js";
import {
  resolveHookCommand,
  effectiveCommandText,
  type ResolvedHookCommand,
} from "./hook-resolver.js";

const MEMORY_MCP_TOOLS = [
  "mcp__agentic-memory__memory_store",
  "mcp__agentic-memory__memory_search",
  "mcp__agentic-memory__memory_recent",
  "mcp__agentic-memory__memory_forget",
  "mcp__agentic-memory__memory_relate",
  "mcp__agentic-memory__memory_stats",
  "mcp__agentic-memory__memory_update",
] as const;

async function resolveAllHooks(
  hooks: ClaudeConfig["hooks"],
  projectRoot: string,
): Promise<ResolvedHookCommand[]> {
  return Promise.all(hooks.map((h) => resolveHookCommand(h, projectRoot)));
}

export async function hasMemoryIndicators(
  config: ClaudeConfig,
  projectRoot: string,
): Promise<boolean> {
  // MCP server in project settings (shared or local)
  if (config.mcpServers.some((s) => s.name === "agentic-memory")) return true;

  // Tool permissions referencing agentic-memory (server may be registered via `claude mcp add`)
  const permissions = (config.settings?.permissions as Record<string, unknown> | undefined) ?? {};
  const localPermissions = (config.localSettings?.permissions as Record<string, unknown> | undefined) ?? {};
  const allowList = [
    ...((permissions.allow as string[] | undefined) ?? []),
    ...((localPermissions.allow as string[] | undefined) ?? []),
  ];
  if (allowList.some((t) => t.startsWith("mcp__agentic-memory__"))) return true;

  // SessionStart hook referencing memory context injection — see through 1-level wrappers
  const resolved = await resolveAllHooks(config.hooks, projectRoot);
  return config.hooks.some((h, i) =>
    h.event === "SessionStart" && effectiveCommandText(resolved[i]).includes("memory context"),
  );
}

/**
 * Analyzes agentic-memory configuration.
 * Returns null if memory is not detected — doctor skips it for non-memory users.
 */
export async function analyzeMemory(
  config: ClaudeConfig,
  projectRoot: string,
): Promise<AnalyzerResult | null> {
  if (!await hasMemoryIndicators(config, projectRoot)) return null;

  const issues: DiagnosticIssue[] = [];
  const resolved = await resolveAllHooks(config.hooks, projectRoot);
  const effectiveAt = (i: number): string => effectiveCommandText(resolved[i]);

  // 1. SessionStart hook with memory context (wrapper-aware)
  const hasSessionStart = config.hooks.some(
    (h, i) => h.event === "SessionStart" && effectiveAt(i).includes("memory context"),
  );
  if (!hasSessionStart) {
    issues.push({
      analyzer: "Memory",
      severity: "high",
      message: "No SessionStart hook with memory context injection",
      fix: "Add a SessionStart hook that runs `memory context` to inject relevant memories",
    });
  }

  // 2. Deprecated Stop hook with memory extract (removed in v0.14.0)
  const hasStaleStopHook = config.hooks.some(
    (h, i) => h.event === "Stop" && effectiveAt(i).includes("memory extract"),
  );
  if (hasStaleStopHook) {
    issues.push({
      analyzer: "Memory",
      severity: "low",
      message: "Deprecated Stop hook found (memory extract) — auto-extraction was removed, Claude stores memories directly via MCP tools",
      fix: "Run `doctor --fix` to remove the stale Stop hook",
    });
  }

  // 3. autoMemoryEnabled should be false (built-in memory conflicts with agentic-memory)
  const autoMemoryDisabled = config.settings?.autoMemoryEnabled === false
    || config.localSettings?.autoMemoryEnabled === false;
  if (!autoMemoryDisabled) {
    issues.push({
      analyzer: "Memory",
      severity: "medium",
      message: "autoMemoryEnabled not disabled — built-in memory may conflict with agentic-memory",
      fix: "Set autoMemoryEnabled: false in settings.json or settings.local.json",
    });
  }

  // 5. CLAUDE.md memory guidance (check both shared and local)
  const hasMemoryGuidance = config.claudeMdContent?.includes("agentic-memory")
    || config.claudeMdContent?.includes("## Memory")
    || config.localClaudeMdContent?.includes("agentic-memory")
    || config.localClaudeMdContent?.includes("## Memory");
  if (!hasMemoryGuidance) {
    issues.push({
      analyzer: "Memory",
      severity: "low",
      message: "CLAUDE.md missing memory guidance section",
      fix: "Add a ## Memory section to CLAUDE.md describing when and how to use agentic-memory",
    });
  }

  // 6. MCP tool permissions (check both shared and local settings)
  const permissions = (config.settings?.permissions as Record<string, unknown> | undefined) ?? {};
  const localPermissions = (config.localSettings?.permissions as Record<string, unknown> | undefined) ?? {};
  const allowList = [
    ...((permissions.allow as string[] | undefined) ?? []),
    ...((localPermissions.allow as string[] | undefined) ?? []),
  ];
  const missingTools = MEMORY_MCP_TOOLS.filter((t) => !allowList.includes(t));
  if (missingTools.length > 0) {
    issues.push({
      analyzer: "Memory",
      severity: "low",
      message: `${missingTools.length} agentic-memory MCP tool permission(s) missing from allowedTools`,
      fix: "Add all agentic-memory tool names to allowedTools in .claude/settings.json",
    });
  }

  // 7. Sync hooks when sync is configured (wrapper-aware)
  const syncConfig = readSyncConfig();
  if (syncConfig) {
    const hasSessionStartPull = config.hooks.some(
      (h, i) => h.event === "SessionStart" && effectiveAt(i).includes("memory pull"),
    );
    if (!hasSessionStartPull) {
      issues.push({
        analyzer: "Memory",
        severity: "medium",
        message: "Sync configured but no SessionStart hook to auto-pull memories before context injection",
        fix: "Run `doctor --fix` to add a SessionStart hook that pulls memories automatically",
      });
    }

    const hasSessionEndPush = config.hooks.some(
      (h, i) => h.event === "SessionEnd" && effectiveAt(i).includes("memory push"),
    );
    if (!hasSessionEndPush) {
      issues.push({
        analyzer: "Memory",
        severity: "medium",
        message: "Sync configured but no SessionEnd hook to auto-push memories after each session",
        fix: "Run `doctor --fix` to add a SessionEnd hook that pushes memories automatically",
      });
    }

    // Backgrounded-push check stays on the literal command — the `&` is always at the hook level,
    // wrappers never prefix their own command with & exit 0.
    const hasStaleBackgroundedPush = config.hooks.some(
      (h) => h.event === "SessionEnd"
        && h.command?.includes("memory push")
        && /&\s*exit\s+0\s*$/.test(h.command),
    );
    if (hasStaleBackgroundedPush) {
      issues.push({
        analyzer: "Memory",
        severity: "high",
        message: "SessionEnd push hook is backgrounded — push gets killed before reaching the gist, deletions never sync",
        fix: "Run `doctor --fix` to upgrade the hook to a synchronous push",
      });
    }
  }

  // 8. Broken wrappers — hook references a .sh script inside the project that doesn't exist.
  // Only report for SessionStart/SessionEnd hooks (the ones this analyzer inspects).
  for (let i = 0; i < config.hooks.length; i++) {
    const h = config.hooks[i];
    if (h.event !== "SessionStart" && h.event !== "SessionEnd") continue;
    for (const missing of resolved[i].missingScripts) {
      issues.push({
        analyzer: "Memory",
        severity: "low",
        message: `${h.event} hook references \`${missing}\` but the file is missing — wrapper can't run`,
        fix: `Create ${missing} or remove the broken hook from .claude/settings.json`,
      });
    }
  }

  const critical = issues.filter((i) => i.severity === "critical").length;
  const high = issues.filter((i) => i.severity === "high").length;
  const medium = issues.filter((i) => i.severity === "medium").length;
  const low = issues.filter((i) => i.severity === "low").length;
  const score = Math.max(0, 100 - (critical * 40 + high * 20 + medium * 10 + low * 5));

  return { name: "Memory", issues, score };
}
