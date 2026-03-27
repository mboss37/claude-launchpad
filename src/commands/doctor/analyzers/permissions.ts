import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";

export async function analyzePermissions(config: ClaudeConfig): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];

  // Check if Bash is allowed without security hooks
  const hasBashSecurity = config.hooks.some(
    (h) => h.event === "PreToolUse" && (h.matcher?.includes("Bash") || !h.matcher),
  );

  const bashAllowed = config.settings?.allowedTools as string[] | undefined;
  const hasBashAutoAllow = bashAllowed?.some((t) =>
    typeof t === "string" && t.toLowerCase().includes("bash"),
  );

  if (hasBashAutoAllow && !hasBashSecurity) {
    issues.push({
      analyzer: "Permissions",
      severity: "high",
      message: "Bash is auto-allowed without a security hook — dangerous commands could run unchecked",
      fix: "Add a PreToolUse hook for Bash that blocks destructive commands (rm -rf, git push --force)",
    });
  }

  // Check for force push protection
  const hasForceProtection = config.hooks.some(
    (h) => h.event === "PreToolUse" && h.command?.includes("force"),
  );
  if (!hasForceProtection) {
    issues.push({
      analyzer: "Permissions",
      severity: "low",
      message: "No force-push protection hook",
      fix: "Add a PreToolUse hook that warns on `git push --force` commands",
    });
  }

  // Check CLAUDE.md for off-limits section
  if (config.claudeMdContent) {
    const hasOffLimits = config.claudeMdContent.includes("## Off-Limits") ||
      config.claudeMdContent.includes("## off-limits");
    if (!hasOffLimits) {
      issues.push({
        analyzer: "Permissions",
        severity: "medium",
        message: "No Off-Limits section in CLAUDE.md — Claude has no guardrails beyond defaults",
        fix: "Add an ## Off-Limits section with project-specific restrictions",
      });
    }
  }

  const score = Math.max(0, 100 - issues.length * 20);
  return { name: "Permissions", issues, score };
}
