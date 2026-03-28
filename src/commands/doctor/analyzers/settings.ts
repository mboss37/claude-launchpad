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

  // Score: deduct for actionable issues only (not info)
  const actionableCount = issues.filter((i) => i.severity !== "info").length;
  const score = Math.max(0, 100 - actionableCount * 20);
  return { name: "Settings", issues, score };
}
