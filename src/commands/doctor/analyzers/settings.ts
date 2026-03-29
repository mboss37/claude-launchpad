import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";

export async function analyzeSettings(config: ClaudeConfig): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];

  if (config.settings === null) {
    issues.push({
      analyzer: "Settings",
      severity: "medium",
      message: "No .claude/settings.json found",
      fix: "Run `claude-launchpad init` or create .claude/settings.json",
    });
    return { name: "Settings", issues, score: 40 };
  }

  // Check for hooks (the most important setting)
  const hooks = config.settings.hooks as Record<string, unknown> | undefined;
  if (!hooks || Object.keys(hooks).length === 0) {
    issues.push({
      analyzer: "Settings",
      severity: "medium",
      message: "settings.json has no hooks configured",
      fix: "Run `claude-launchpad doctor --fix` to generate hooks",
    });
  }

  // Plugins are optional — info only, doesn't affect score
  const plugins = config.settings.enabledPlugins as Record<string, boolean> | undefined;
  if (!plugins || Object.keys(plugins).length === 0) {
    issues.push({
      analyzer: "Settings",
      severity: "info",
      message: "No plugins enabled — plugins are optional but can add capabilities",
    });
  }

  // Permission rules — only flag if allowedTools is set without security hooks
  const allowedTools = config.settings.allowedTools as string[] | undefined;
  if (allowedTools && allowedTools.length > 0 && config.hooks.length === 0) {
    issues.push({
      analyzer: "Settings",
      severity: "medium",
      message: "Tools auto-allowed without any hooks — no safety net for dangerous operations",
      fix: "Add PreToolUse hooks for security or remove allowedTools to use interactive prompting",
    });
  }

  // Deprecated includeCoAuthoredBy
  if (config.settings.includeCoAuthoredBy !== undefined) {
    issues.push({
      analyzer: "Settings",
      severity: "low",
      message: "Deprecated includeCoAuthoredBy — use attribution: { commit: \"\", pr: \"\" } instead",
      fix: "Replace includeCoAuthoredBy with the attribution object in settings.json",
    });
  }

  // Monorepo hint — claudeMdExcludes
  if (!config.settings.claudeMdExcludes) {
    issues.push({
      analyzer: "Settings",
      severity: "info",
      message: "No claudeMdExcludes configured — consider adding this if you have a monorepo",
    });
  }

  // Hook timeouts on broad matchers
  const broadMatchers = ["Bash", "Write", "Edit", "Read"];
  const hooksWithoutTimeout = config.hooks.filter(
    (h) => !h.timeout && broadMatchers.some((m) => h.matcher?.includes(m)),
  );
  if (hooksWithoutTimeout.length > 0) {
    issues.push({
      analyzer: "Settings",
      severity: "low",
      message: `${hooksWithoutTimeout.length} hook(s) on broad matchers without timeout — defaults to 60s per invocation`,
      fix: "Add timeout (in seconds) to hooks on Bash, Write, Edit, or Read matchers",
    });
  }

  // Auto-memory disabled
  if (config.settings.autoMemoryEnabled === false) {
    const hasMemorySection = config.claudeMdContent?.includes("## Memory") ?? false;
    if (!hasMemorySection) {
      issues.push({
        analyzer: "Settings",
        severity: "medium",
        message: "Auto-memory is disabled with no manual memory strategy in CLAUDE.md",
        fix: "Re-enable autoMemoryEnabled or add a ## Memory section to CLAUDE.md",
      });
    }
  }

  // Score: deduct for actionable issues only (not info)
  const actionableCount = issues.filter((i) => i.severity !== "info").length;
  const score = Math.max(0, 100 - actionableCount * 20);
  return { name: "Settings", issues, score };
}
