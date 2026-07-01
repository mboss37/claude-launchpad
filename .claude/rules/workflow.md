---
paths: ["BACKLOG.md", "TASKS.md"]
---

# Backlog → Tasks → Sprint Workflow Rules

<!-- lp-workflow-version: 1 -->

These rules apply whenever editing `BACKLOG.md` or `TASKS.md`. The workflow is load-bearing — drift here breaks sprint integrity.

## The single rule that makes everything else work

**A work package (WP) lives in exactly one of `BACKLOG.md` or `TASKS.md` at any time.**

- Pulled into a sprint → move (delete from BACKLOG.md, add to TASKS.md under `## Current Sprint`) in a single edit.
- Sprint closed → the WP leaves TASKS.md entirely (summarized into `## Completed Sprints`) and does not return to the backlog.
- A WP ID appearing in both files at once = bug. A PostToolUse hook warns.

## WP IDs

- Format: `WP-NNN` (three digits, zero-padded).
- Minted on first entry to `BACKLOG.md`.
- Never reused, never renamed.
- Highest-used ID lives at the end of `BACKLOG.md ## Changelog` — check there before minting a new one.

## BACKLOG.md structure (mandatory sections, in order)

1. Header + rules comment block
2. `## Priority definitions` table
3. `## Work package template` (the canonical format)
4. `## P0 — Next sprint`
5. `## P1 — Soon (within 2–3 sprints)`
6. `## P2 — Post-MVP / nice-to-have`
7. `## P3 — Parked`
8. `## Changelog`

### Every WP entry must include

- `Priority:` exactly one of P0/P1/P2/P3
- `Proposed:` ISO date (YYYY-MM-DD)
- `Stories / Docs:` spec references, issues, or empty
- `Depends on:` WP IDs or empty
- `Estimate:` one of XS/S/M/L/XL (XL must be decomposed before pulling)
- `Trigger to pull:` what event promotes this to an active sprint
- `Definition of done:` concrete acceptance criteria
- One-paragraph description

### Priority discipline

- P0 items are for the next sprint. If P0 is empty at sprint start, pull the top P1.
- P1 → P0 promotion happens during sprint wrap-up, not mid-sprint.
- P2 items get a monthly review. P3 items get a quarterly review and are deleted if still untouched.
- Stale P0 items (>2 weeks without movement) are a flag: either pull or demote.

### Changelog discipline

- Every WP promotion, demotion, or deletion gets a one-line entry with the date.
- A backlog audit that finds no changelog entries for 30+ days = staleness; force a review.

## TASKS.md structure (mandatory sections, in order)

1. Header + rules comment
2. `## Current Sprint`
3. `## Completed Sprints`
4. `## Session Log`

### `## Current Sprint` discipline

- Contains ONLY the active sprint's WPs. Empty between sprints.
- Format: `- [ ] WP-NNN — short title` (checkbox + WP ID + title from backlog).
- Each pulled WP becomes one checklist item. Sub-tasks nest with two-space indent, still checkbox.
- New ideas that surface mid-sprint go to `BACKLOG.md`, never appended here.

### `## Completed Sprints` discipline

- One line per sprint. Format: `- **SN**: one-sentence outcome + key metric if any.`
- Never a wall of text. Detail lives in git history (or your review file).

### `## Session Log` discipline

- Max 3 entries, most recent 3 sessions only.
- Each entry: `- **YYYY-MM-DD (optional window):** what changed this session + what's next.`
- Older entries deleted, not archived — they're in git history if needed.

### Size discipline

- Whole file stays under 80 lines.
- If `## Current Sprint` exceeds 15 checkboxes, the sprint is too big — split it (move some WPs back to `BACKLOG.md` P0).

## Sprint lifecycle (the exact edit sequence)

### Starting a sprint (one session, one commit)

1. Pick top-priority WPs from `BACKLOG.md` (P0 first).
2. **Same edit:** delete them from `BACKLOG.md`, add them to `TASKS.md ## Current Sprint`.
3. Update `BACKLOG.md ## Changelog`: `YYYY-MM-DD: WP-NNN pulled into Sprint SN`.
4. Write the sprint plan (outline approach, success criteria, tests to add).
5. For hard-TDD surfaces, write the test spec **before** implementation.
6. Commit the pull + plan together: `chore(sprint-N): pull WP-NNN into sprint + plan`.

### Closing a sprint (one session, one commit)

1. All `## Current Sprint` items checked off, or explicitly moved back to backlog with rationale.
2. Run your review workflow — verify typecheck, tests, and convention compliance before declaring done.
3. Add one-line summary to `## Completed Sprints`.
4. Empty `## Current Sprint` back to the placeholder comment.
5. Update `## Session Log` (prune to 3 entries).
6. `BACKLOG.md ## Changelog`: `YYYY-MM-DD: Sprint SN closed. WP-NNN done.`

## What triggers a staleness warning

A PostToolUse hook fires warnings on these conditions (treat as bugs):

- A WP ID appears in both `BACKLOG.md` and `TASKS.md`.
- `TASKS.md` exceeds 80 lines.
- `## Current Sprint` has >15 items.
- `## Session Log` has >3 entries.

## Do not

- Don't append to `TASKS.md` without first checking `BACKLOG.md` for the WP — silent duplication breaks the source-of-truth rule.
- Don't leave `## Current Sprint` populated between sprints. An empty sprint section is how you know the last sprint closed cleanly.
- Don't invent ad-hoc WP formats. Use the template or update the template — never both.
- Don't rewrite `## Completed Sprints` into prose. One line each. Forever.
- Don't put anything in `TASKS.md` that hasn't passed through `BACKLOG.md` first. Ideas → backlog → sprint. No shortcuts.
