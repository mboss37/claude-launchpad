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

  // Check for plugins
  const plugins = config.settings.enabledPlugins as Record<string, boolean> | undefined;
  if (!plugins || Object.keys(plugins).length === 0) {
    issues.push({
      analyzer: "Settings",
      severity: "low",
      message: "No plugins enabled",
      fix: "Consider enabling plugins for enhanced capabilities",
    });
  }

  // Check for permission rules
  const permissions = config.settings.permissions as Record<string, unknown> | undefined;
  if (!permissions) {
    issues.push({
      analyzer: "Settings",
      severity: "low",
      message: "No permission rules configured",
      fix: "Add permission rules to control which tools Claude can use automatically",
    });
  }

  // Check for environment variables
  const env = config.settings.env as Record<string, string> | undefined;
  if (!env) {
    issues.push({
      analyzer: "Settings",
      severity: "info",
      message: "No environment variables defined in settings",
      fix: "Define env vars in settings.json for consistent development environments",
    });
  }

  const score = Math.max(0, 100 - issues.length * 15);
  return { name: "Settings", issues, score };
}
