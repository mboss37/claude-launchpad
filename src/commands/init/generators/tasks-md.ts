import type { InitOptions } from "../../../types/index.js";

const DEFAULT_WORKFLOW_RULE = ".claude/rules/workflow.md";

export function generateTasksMd(
  options: InitOptions,
  extras: { readonly workflowRulePath?: string } = {},
): string {
  const workflowRulePath = extras.workflowRulePath ?? DEFAULT_WORKFLOW_RULE;
  const opener =
    workflowRulePath === DEFAULT_WORKFLOW_RULE
      ? "Claude: Read at session start."
      : "Read at session start.";
  return `# ${options.name} — Task Tracker

> ${opener} See \`${workflowRulePath}\` for the rules.
>
> - \`## Current Sprint\` holds ONLY active-sprint WPs. Empty between sprints.
> - WPs are pulled from \`BACKLOG.md\` into here (moved, not copied).
> - Under 80 lines total. Session log: 3 entries max, most recent sessions only.

---

## Current Sprint

<!-- EMPTY. Pull WPs from BACKLOG.md when ready. Format: \`- [ ] WP-NNN — short title\` -->

---

## Completed Sprints

<!-- One line per sprint. Format: \`- **SN**: one-sentence outcome.\` Detail lives in git history. -->

---

## Session Log

<!-- Most recent session at the top. Max 3 entries. Format: \`- **YYYY-MM-DD:** what changed + what's next.\` -->
`;
}
