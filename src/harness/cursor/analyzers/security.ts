import type { AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";
import type { CursorConfig } from "../types.js";
import { scoreIssues } from "./score.js";

export async function analyzeCursorSecurity(
  config: CursorConfig,
): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = config.parseErrors
    .filter((error) => error.path.endsWith("sandbox.json"))
    .map((error) => ({
      analyzer: "Security",
      severity: "high" as const,
      message: `Malformed ${error.path}: ${error.message}`,
      fix: "Fix the JSON syntax; doctor will not overwrite it",
    }));
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

  return { name: "Security", issues, score: scoreIssues(issues) };
}
