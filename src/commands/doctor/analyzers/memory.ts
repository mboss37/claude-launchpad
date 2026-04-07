import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";
import { readSyncConfig } from "../../memory/utils/gist-transport.js";

const MEMORY_MCP_TOOLS = [
  "mcp__agentic-memory__memory_store",
  "mcp__agentic-memory__memory_search",
  "mcp__agentic-memory__memory_recent",
  "mcp__agentic-memory__memory_forget",
  "mcp__agentic-memory__memory_relate",
  "mcp__agentic-memory__memory_stats",
  "mcp__agentic-memory__memory_update",
] as const;

export function hasMemoryIndicators(config: ClaudeConfig): boolean {
  return config.mcpServers.some((s) => s.name === "agentic-memory");
}

/**
 * Analyzes agentic-memory configuration.
 * Returns null if memory is not detected — doctor skips it for non-memory users.
 */
export async function analyzeMemory(config: ClaudeConfig): Promise<AnalyzerResult | null> {
  if (!hasMemoryIndicators(config)) return null;

  const issues: DiagnosticIssue[] = [];

  // 1. SessionStart hook with memory context
  const hasSessionStart = config.hooks.some(
    (h) => h.event === "SessionStart" && h.command?.includes("memory context"),
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
    (h) => h.event === "Stop" && h.command?.includes("memory extract"),
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

  // 7. SessionEnd push hook when sync is configured
  const syncConfig = readSyncConfig();
  if (syncConfig) {
    const hasSessionEndPush = config.hooks.some(
      (h) => h.event === "SessionEnd" && h.command?.includes("memory push"),
    );
    if (!hasSessionEndPush) {
      issues.push({
        analyzer: "Memory",
        severity: "medium",
        message: "Sync configured but no SessionEnd hook to auto-push memories after each session",
        fix: "Run `doctor --fix` to add a SessionEnd hook that pushes memories automatically",
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
