import type { DetectedProject, DiagnosticIssue } from "../../types/index.js";
import { detectProject } from "../../lib/detect.js";
import {
  addEnvToCursorIgnore,
  createOrUpdateVerificationRule,
} from "./fixers/files.js";
import {
  createOrMergeCursorHooks,
  refreshCursorHookScripts,
} from "./fixers/hooks.js";

export interface CursorFixResult {
  readonly fixed: number;
  readonly skipped: number;
}

type CursorFix = (root: string, detected: DetectedProject) => Promise<boolean>;

const CURSOR_FIXES: ReadonlyArray<{
  readonly analyzer: string;
  readonly match: string;
  readonly fix: CursorFix;
}> = [
  {
    analyzer: "Rules",
    match: "No .cursor/rules/verification.mdc",
    fix: (root) => createOrUpdateVerificationRule(root),
  },
  {
    analyzer: "Rules",
    match: "verification.mdc rule is outdated",
    fix: (root) => createOrUpdateVerificationRule(root),
  },
  {
    analyzer: "Security",
    match: ".env is missing from .cursorignore",
    fix: (root) => addEnvToCursorIgnore(root),
  },
  {
    analyzer: "Hooks",
    match: "No Cursor hooks configured",
    fix: async (root, detected) => {
      const hooks = await createOrMergeCursorHooks(root, detected);
      const scripts = await refreshCursorHookScripts(root, detected);
      return hooks || scripts;
    },
  },
  {
    analyzer: "Hooks",
    match: "security hook is not fail-closed",
    fix: (root, detected) => createOrMergeCursorHooks(root, detected),
  },
  {
    analyzer: "Hooks",
    match: "Hook script missing:",
    fix: (root, detected) => refreshCursorHookScripts(root, detected),
  },
  {
    analyzer: "Hooks",
    match: "missing .env read protection",
    fix: (root, detected) => createOrMergeCursorHooks(root, detected),
  },
  {
    analyzer: "Hooks",
    match: "missing destructive-shell protection",
    fix: (root, detected) => createOrMergeCursorHooks(root, detected),
  },
  {
    analyzer: "Hooks",
    match: "missing auto-format",
    fix: (root, detected) => createOrMergeCursorHooks(root, detected),
  },
  {
    analyzer: "Hooks",
    match: "missing workflow check",
    fix: (root, detected) => createOrMergeCursorHooks(root, detected),
  },
  {
    analyzer: "Hooks",
    match: "missing session context",
    fix: (root, detected) => createOrMergeCursorHooks(root, detected),
  },
  {
    analyzer: "Hooks",
    match: "stale Launchpad hook script",
    fix: (root, detected) => refreshCursorHookScripts(root, detected),
  },
];

export async function applyCursorFixes(
  issues: ReadonlyArray<DiagnosticIssue>,
  root: string,
): Promise<CursorFixResult> {
  const detected = await detectProject(root);
  let fixed = 0;
  let skipped = 0;
  for (const issue of issues) {
    const applied = await tryCursorFix(issue, root, detected);
    if (applied) fixed += 1;
    else skipped += 1;
  }
  return { fixed, skipped };
}

async function tryCursorFix(
  issue: DiagnosticIssue,
  root: string,
  detected: DetectedProject,
): Promise<boolean> {
  const entry = CURSOR_FIXES.find(
    (row) =>
      row.analyzer === issue.analyzer && issue.message.includes(row.match),
  );
  if (!entry) return false;
  return entry.fix(root, detected);
}
