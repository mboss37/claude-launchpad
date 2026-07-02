export const WORKFLOW_RULE_VERSION = 2;

export function generateWorkflowRule(): string {
  return `---
paths: ["BACKLOG.md", "TASKS.md"]
---

# Backlog → Tasks → Sprint Workflow Rules

<!-- lp-workflow-version: ${WORKFLOW_RULE_VERSION} -->

These rules apply whenever editing \`BACKLOG.md\` or \`TASKS.md\`. The workflow is load-bearing — drift here breaks sprint integrity.

## The single rule that makes everything else work

**A work package (WP) lives in exactly one of \`BACKLOG.md\` or \`TASKS.md\` at any time.**

- Pulled into a sprint → move (delete from BACKLOG.md, add to TASKS.md under \`## Current Sprint\`) in a single edit.
- Sprint closed → the WP leaves TASKS.md entirely (summarized into \`## Completed Sprints\`) and does not return to the backlog.
- A WP entry appearing in both files at once = bug. \`workflow-check.sh\` injects a warning into context when it sees one (Changelog and \`Depends on:\` mentions are fine).

## WP IDs

- Format: \`WP-NNN\` (three digits, zero-padded; grows to four digits past WP-999).
- Minted on first entry to \`BACKLOG.md\`; log every mint in \`## Changelog\`: \`YYYY-MM-DD: WP-NNN added (P1)\`.
- Never reused, never renamed.
- To find the highest used ID before minting: \`grep -ohE 'WP-[0-9]+' BACKLOG.md TASKS.md | sort -V | tail -1\`.

## BACKLOG.md structure (mandatory sections, in order)

1. Header + rules comment block
2. \`## Priority definitions\` table
3. \`## Work package template\` (the canonical format)
4. \`## P0 — Next sprint\`
5. \`## P1 — Soon (within 2–3 sprints)\`
6. \`## P2 — Post-MVP / nice-to-have\`
7. \`## P3 — Parked\`
8. \`## Changelog\`

### Every WP entry must include

- \`Priority:\` exactly one of P0/P1/P2/P3
- \`Proposed:\` ISO date (YYYY-MM-DD)
- \`Stories / Docs:\` spec references, issues, or empty
- \`Depends on:\` WP IDs or empty
- \`Estimate:\` one of XS/S/M/L/XL (XL must be decomposed before pulling)
- \`Trigger to pull:\` what event promotes this to an active sprint
- \`Definition of done:\` concrete acceptance criteria
- One-paragraph description

### Priority discipline

- P0 items are for the next sprint. If P0 is empty at sprint start, pull the top P1.
- P1 → P0 promotion happens during sprint wrap-up, not mid-sprint.
- P2 items get a monthly review. P3 items get a quarterly review and are deleted if still untouched.
- Stale P0 items (>2 weeks without movement) are a flag: either pull or demote.

### Changelog discipline

- Every WP mint, promotion, demotion, or deletion gets a one-line entry with the date.
- A backlog audit that finds no changelog entries for 30+ days = staleness; force a review.

## TASKS.md structure (mandatory sections, in order)

1. Header + rules comment
2. \`## Current Sprint\`
3. \`## Completed Sprints\`
4. \`## Session Log\`

### \`## Current Sprint\` discipline

- Contains ONLY the active sprint's WPs. Empty between sprints.
- Format: \`- [ ] WP-NNN — short title\` (checkbox + WP ID + title from backlog).
- Each pulled WP becomes one checklist item. Sub-tasks nest with two-space indent, still checkbox.
- New ideas that surface mid-sprint go to \`BACKLOG.md\`, never appended here.

### \`## Completed Sprints\` discipline

- One line per sprint. Format: \`- **SN**: one-sentence outcome + key metric if any.\`
- Never a wall of text. Detail lives in git history (or your review file).

### \`## Session Log\` discipline

- Max 3 entries, most recent 3 sessions only.
- Each entry: \`- **YYYY-MM-DD (optional window):** what changed this session + what's next.\`
- Older entries deleted, not archived — they're in git history if needed.

### Size discipline

- Whole file stays under 80 lines.
- Aim for 3-6 WPs per sprint (soft target — \`sprint-size-check.sh\` nudges at session start).
- If \`## Current Sprint\` exceeds 15 checkboxes, the sprint is too big — split it (hard trigger; \`workflow-check.sh\` warns).

## Sprint lifecycle (the exact edit sequence)

### Starting a sprint (one session, one commit)

1. Pick top-priority WPs from \`BACKLOG.md\` (P0 first).
2. **Same edit:** delete them from \`BACKLOG.md\`, add them to \`TASKS.md ## Current Sprint\`.
3. Update \`BACKLOG.md ## Changelog\`: \`YYYY-MM-DD: WP-NNN pulled into Sprint SN\`.
4. Write the sprint plan (outline approach, success criteria, tests to add).
5. For hard-TDD surfaces (see "Testing Discipline" in \`.claude/rules/conventions.md\`), write the test spec **before** implementation.
6. Commit the pull + plan together: \`chore(sprint-N): pull WP-NNN into sprint + plan\`.

### Closing a sprint (one session, one commit)

1. All \`## Current Sprint\` items checked off, or explicitly moved back to backlog with rationale.
2. Review the sprint diff: find the base with \`git log --grep 'chore(sprint-' -n 1 --format=%H\`, run \`/code-review\` against it, and fix all Critical/Important findings. Then run the project's test and typecheck commands — both must pass.
3. Add one-line summary to \`## Completed Sprints\`.
4. Empty \`## Current Sprint\` back to the placeholder comment.
5. Update \`## Session Log\` (prune to 3 entries).
6. \`BACKLOG.md ## Changelog\`: \`YYYY-MM-DD: Sprint SN closed. WP-NNN done.\`

## What triggers a staleness warning

\`workflow-check.sh\` (PostToolUse on BACKLOG/TASKS edits) injects warnings into context — as \`additionalContext\`, so the model actually sees them — on these conditions (treat as bugs):

- A WP entry lives in both a \`BACKLOG.md\` P-section and \`## Current Sprint\`.
- \`TASKS.md\` exceeds 80 lines.
- \`## Current Sprint\` has >15 items.
- \`## Session Log\` has >3 entries.
- A pulled WP's \`Depends on:\` dependency still sits in a BACKLOG P-section.

\`sprint-open-check.sh\` (PostToolUse on Bash) additionally warns after a \`git commit\` that pulls WPs into the sprint without deleting anything from \`BACKLOG.md\` — fix with \`git commit --amend\` before pushing.

## Do not

- Don't append to \`TASKS.md\` without first checking \`BACKLOG.md\` for the WP — silent duplication breaks the source-of-truth rule.
- Don't leave \`## Current Sprint\` populated between sprints. An empty sprint section is how you know the last sprint closed cleanly.
- Don't invent ad-hoc WP formats. Use the template or update the template — never both.
- Don't rewrite \`## Completed Sprints\` into prose. One line each. Forever.
- Don't put anything in \`TASKS.md\` that hasn't passed through \`BACKLOG.md\` first. Ideas → backlog → sprint. No shortcuts.
`;
}
