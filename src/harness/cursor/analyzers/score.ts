import type { DiagnosticIssue } from "../../../types/index.js";

export function scoreIssues(issues: ReadonlyArray<DiagnosticIssue>): number {
  return Math.max(
    0,
    100 - issues.filter((issue) => issue.severity !== "info").length * 25,
  );
}
