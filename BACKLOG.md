# claude-launchpad — Backlog

> **Single source of truth for future work.** Every work package (WP) that's been proposed but not yet started lives here.
>
> Rules (see `.claude/rules/workflow.md` for the full lifecycle):
> - Every WP uses the template below — no freeform entries.
> - WPs are **moved** to `TASKS.md` when pulled into a sprint, not copied. A WP lives in exactly one file at a time.
> - Priority ordering: **P0 > P1 > P2 > P3**. P0 items sit at the top.
> - A WP ID is minted when the WP is first added here and never reused.

---

## Priority definitions

| Priority | Meaning |
|---|---|
| **P0** | Blocks launch or an active sprint. Next sprint or sooner. |
| **P1** | Important for MVP. Pulled within 2–3 sprints. |
| **P2** | Post-MVP or nice-to-have. Review monthly. |
| **P3** | Parked idea. Review quarterly; delete if still untouched. |

---

## Work package template (copy this exactly)

```markdown
### WP-NNN — <short imperative title>

- **Priority:** P0 | P1 | P2 | P3
- **Proposed:** YYYY-MM-DD
- **Stories / Docs:** links to specs, issues, or "none yet"
- **Depends on:** WP-MMM (empty if none)
- **Estimate:** XS (<1h) | S (half-day) | M (1–2 days) | L (full sprint) | XL (>1 sprint; must decompose)
- **Trigger to pull:** What has to be true before this moves into a sprint.
- **Definition of done:** Exactly what "done" looks like.

One-paragraph description.
```

---

## P0 — Next sprint

<!-- Empty. -->

---

## P1 — Soon (within 2–3 sprints)

<!-- Empty. -->

---

## P2 — Post-MVP / nice-to-have

### WP-001 — Pre-commit-gate workflow + `/lp-code-review` skill

- **Priority:** P2
- **Proposed:** 2026-05-04
- **Stories / Docs:** none yet
- **Depends on:** none
- **Estimate:** L
- **Trigger to pull:** After v1.10.0 launch; only if user feedback asks for stricter release gates than the current warn-only workflow-check hook.
- **Definition of done:** `init --strict` flag ships a `/lp-code-review` skill + PreToolUse Bash gate on `git commit` that requires a `.claude/state/last-review-<shasum>` marker written by the skill after typecheck/lint/test pass.

Opinionated workflow for teams that want belt-and-braces. Own sprint because of skill authoring + hook + state management + docs.

---

## P3 — Parked

### WP-002 — Eval precondition check

- **Priority:** P3
- **Proposed:** 2026-05-04
- **Stories / Docs:** none yet
- **Depends on:** none
- **Estimate:** XS
- **Trigger to pull:** If a user files an issue saying "eval reports 0 passed silently with no CLAUDE.md."
- **Definition of done:** `eval` command runs `parseClaudeConfig` up front; fails fast with "Run `claude-launchpad init` first" when no CLAUDE.md / settings.

### WP-003 — Cast cleanup in `watcher.ts`

- **Priority:** P3
- **Proposed:** 2026-05-04
- **Stories / Docs:** `src/commands/doctor/watcher.ts:53`
- **Depends on:** none
- **Estimate:** XS
- **Trigger to pull:** Paired with any other watcher work, or as filler between larger sprints.
- **Definition of done:** `as unknown as { parentPath?: string }` replaced with a proper type guard; `pnpm typecheck` stays green; no behavior change.

### WP-004 — Memory: auto-relation discovery at store time

- **Priority:** P3
- **Proposed:** 2026-05-04
- **Stories / Docs:** Sprint 26 memory benchmarks (71.7% oracle baseline)
- **Depends on:** none
- **Estimate:** M
- **Trigger to pull:** If injection quality regresses below 65% on the benchmark suite.
- **Definition of done:** `memory_store` runs a lightweight similarity search over existing memories and auto-creates relations when overlap is high; benchmarks stay ≥70%.

### WP-005 — `lp-migrate-memory` local placement + new-project skip

- **Priority:** P3
- **Proposed:** 2026-05-04
- **Stories / Docs:** none yet
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** If a user files an issue about the skill landing in the wrong location.
- **Definition of done:** Local placement installs the skill to `~/.claude/skills/`; projects with no legacy `~/.claude/projects/*/memory/` files skip skill creation.

### WP-006 — Auto-title untitled memories at store time

- **Priority:** P3
- **Proposed:** 2026-05-04
- **Stories / Docs:** none yet
- **Depends on:** none
- **Estimate:** XS
- **Trigger to pull:** Any sprint that already touches `memory_store` — piggyback.
- **Definition of done:** When `memory_store` is called without a title, derive one from the first ~40 chars of content; dashboard stops showing "(untitled)".

### WP-007 — Doctor plan/apply architecture (v2.0.0)

- **Priority:** P3
- **Proposed:** 2026-05-04
- **Stories / Docs:** none yet
- **Depends on:** none
- **Estimate:** XL (must decompose before pulling)
- **Trigger to pull:** Deferred; Sprint 25 LP-STUB markers cover most of the "unclear what changed" pain. Pull only if we commit to a 2.0.0 release cycle.
- **Definition of done:** `doctor --plan` writes a plan file; `doctor --apply <plan>` executes; direct-write `--fix` is deprecated or hidden behind a flag.

### WP-008 — Remove or hide `doctor --watch`

- **Priority:** P3
- **Proposed:** 2026-05-04
- **Stories / Docs:** `src/commands/doctor/watcher.ts`
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** If someone files an issue mentioning it; otherwise leave dormant.
- **Definition of done:** `--watch` is either removed or hidden from `--help`; no user ever asked for it.

### WP-009 — Fumadocs `.mdx` extension middleware

- **Priority:** P3
- **Proposed:** 2026-05-04
- **Stories / Docs:** `docs/next.config.mjs` (GitHub Pages static export)
- **Depends on:** Vercel migration
- **Estimate:** S
- **Trigger to pull:** Only after docs host migrates off GitHub Pages.
- **Definition of done:** `/docs/foo.mdx` serves rendered MDX via Next middleware.

---

## Launch Campaign (not WPs — marketing backlog)

- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch

---

## Changelog

- **2026-05-04:** Backlog migrated to WP template during Sprint 31 (v1.10.0). Shipped: Story Tightening (v1.9.1+), Path-scoped rules (as `.claude/rules/workflow.md`). Dropped: "dead generator" half of the watcher cleanup item — `generateBacklogMd` is now load-bearing. 9 WPs seeded (WP-001..WP-009).
