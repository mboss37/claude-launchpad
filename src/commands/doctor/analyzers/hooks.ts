import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";

export async function analyzeHooks(config: ClaudeConfig): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];
  const hooks = config.hooks;

  if (hooks.length === 0) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message: "No hooks configured — CLAUDE.md rules are advisory (~80% compliance), hooks are 100%",
      fix: "Add PostToolUse hooks for auto-formatting and PreToolUse for security gates",
    });
    return { name: "Hooks", issues, score: 30 };
  }

  // Check for auto-format hook (prettier, ruff, gofmt, rustfmt, etc.)
  const formatPatterns = ["format", "prettier", "gofmt", "rustfmt", "rubocop", "pint", "ktlint", "swift-format", "dotnet format"];
  const hasPostFormat = hooks.some(
    (h) => h.event === "PostToolUse" && h.matcher?.includes("Write") && formatPatterns.some((p) => h.command?.includes(p)),
  );
  if (!hasPostFormat) {
    issues.push({
      analyzer: "Hooks",
      severity: "low",
      message: "No auto-format hook found",
      fix: "Add a PostToolUse hook that runs your formatter on Write|Edit",
    });
  }

  // Check for security gate (env file protection)
  const hasEnvProtection = hooks.some(
    (h) => h.event === "PreToolUse" && h.command?.includes(".env"),
  );
  if (!hasEnvProtection) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message: "No .env file protection hook — Claude could read or write secrets in .env files",
      fix: "Add a PreToolUse hook on Read|Write|Edit that blocks access to .env files",
    });
  }

  // Check for PreToolUse hooks (security layer)
  const hasPreToolUse = hooks.some((h) => h.event === "PreToolUse");
  if (!hasPreToolUse) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message: "No PreToolUse hooks — this is your security enforcement layer",
      fix: "Add PreToolUse hooks for file protection and dangerous command blocking",
    });
  }

  // Check for PostCompact hook (session continuity)
  const hasPostCompact = hooks.some((h) => h.event === "PostCompact");
  if (!hasPostCompact) {
    issues.push({
      analyzer: "Hooks",
      severity: "low",
      message: "No PostCompact hook — session context is lost when conversation is compacted",
      fix: "Add a PostCompact hook that re-injects TASKS.md after compaction",
    });
  }

  // Check for SessionStart hook
  const hasSessionStart = hooks.some((h) => h.event === "SessionStart");
  if (!hasSessionStart) {
    issues.push({
      analyzer: "Hooks",
      severity: "low",
      message: "No SessionStart hook — session starts without project context loaded",
      fix: "Add a SessionStart hook that injects TASKS.md at startup",
    });
  }

  const score = Math.max(0, 100 - issues.length * 15);
  return { name: "Hooks", issues, score };
}
