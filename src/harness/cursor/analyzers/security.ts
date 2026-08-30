import type { AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";
import type { CursorConfig } from "../types.js";

export async function analyzeCursorSecurity(
  config: CursorConfig,
): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];
  const ignore = config.ignoreContent ?? "";
  if (
    !/(^|\n)\.env(\n|$)/.test(ignore) &&
    !/(^|\n)\.env\.\*(\n|$)/.test(ignore)
  ) {
    issues.push({
      analyzer: "Security",
      severity: "medium",
      message: ".env is missing from .cursorignore",
      fix: "Add .env and .env.* to .cursorignore (keep !.env.example)",
    });
  }

  if (config.sandbox !== null && typeof config.sandbox !== "object") {
    issues.push({
      analyzer: "Security",
      severity: "low",
      message: ".cursor/sandbox.json is not a JSON object",
      fix: "Fix sandbox.json or remove it",
    });
  }

  return { name: "Security", issues, score: scoreIssues(issues) };
}

function scoreIssues(issues: ReadonlyArray<DiagnosticIssue>): number {
  return Math.max(
    0,
    100 - issues.filter((issue) => issue.severity !== "info").length * 25,
  );
}
