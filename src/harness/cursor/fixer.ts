import type { DiagnosticIssue } from "../../types/index.js";
import {
  addEnvToCursorIgnore,
  createOrUpdateVerificationRule,
} from "./fixers/files.js";

export interface CursorFixResult {
  readonly fixed: number;
  readonly skipped: number;
}

type CursorFix = (root: string) => Promise<boolean>;

const CURSOR_FIXES: ReadonlyArray<{
  readonly analyzer: string;
  readonly match: string;
  readonly fix: CursorFix;
}> = [
  {
    analyzer: "Rules",
    match: "No .cursor/rules/verification.mdc",
    fix: createOrUpdateVerificationRule,
  },
  {
    analyzer: "Rules",
    match: "verification.mdc rule is outdated",
    fix: createOrUpdateVerificationRule,
  },
  {
    analyzer: "Security",
    match: ".env is missing from .cursorignore",
    fix: addEnvToCursorIgnore,
  },
];

export async function applyCursorFixes(
  issues: ReadonlyArray<DiagnosticIssue>,
  root: string,
): Promise<CursorFixResult> {
  let fixed = 0;
  let skipped = 0;
  for (const issue of issues) {
    const applied = await tryCursorFix(issue, root);
    if (applied) fixed += 1;
    else skipped += 1;
  }
  return { fixed, skipped };
}

async function tryCursorFix(
  issue: DiagnosticIssue,
  root: string,
): Promise<boolean> {
  const entry = CURSOR_FIXES.find(
    (row) =>
      row.analyzer === issue.analyzer && issue.message.includes(row.match),
  );
  if (!entry) return false;
  return entry.fix(root);
}
