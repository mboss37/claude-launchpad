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

### WP-010 — SessionEnd memory push: test `async: true` against current `nohup` wrapper

- **Priority:** P2
- **Proposed:** 2026-05-04
- **Stories / Docs:** memory tag "SessionEnd hook must use nohup — synchronous gets SIGTERM'd" (v1.7.2 fix); Claude Code hooks API v2.1+ `async`/`asyncRewake` fields
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** Any sprint touching memory hooks, or if a user reports nohup-related quirks (orphan processes, stderr noise, log files in cwd).
- **Definition of done:** A reproducible test confirms whether `{"type":"command","command":"...","async":true}` survives Claude Code's SIGTERM-on-session-end the same way the `nohup ... </dev/null >/dev/null 2>&1 & exit 0` wrapper does. If equivalent: `fixer-memory.ts` and `install.ts` emit the native `async: true` form and a doctor LOW finding upgrades pre-existing nohup-wrapped hooks. If not equivalent: a comment in `hook-scripts.ts` documents why nohup stays.

The `nohup` pattern was a verified v1.7.2 fix because Claude Code SIGTERMs SessionEnd hooks before `memory push` finishes (~3s GitHub API call). The hooks API now ships an `async: true` flag that is plausibly the official mechanism for this exact case. Verify before swapping — nohup is load-bearing.

### WP-011 — Replace inline shell guards in PreToolUse hooks with `if:` syntax

- **Priority:** P2
- **Proposed:** 2026-05-04
- **Stories / Docs:** Claude Code hooks API v2.1.85 (`if` field for permission-rule-style filtering)
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** Any sprint touching `init` settings generation, or paired with WP-010 as a hook-modernization mini-sprint.
- **Definition of done:** The `.env` PreToolUse block (`Read|Write|Edit` matcher) and the destructive-Bash block (`Bash` matcher) in `src/commands/init/generators/settings.ts` use the `if:` field with permission-rule strings instead of inline grep. `pnpm test:run` stays green; regression test confirms blocking behavior is unchanged for `.env` reads, `rm -rf /`, `git push --force`, and `DROP TABLE`.

Currently the two PreToolUse guards grep `tool_input.command` / `tool_input.file_path` in shell to decide block/allow. The new `if:` field lets Claude Code itself filter hooks by permission rule (`"if": "Bash(rm *)"`) — cleaner, less brittle, and one fewer subprocess per tool call. Pure refactor; behavior identical.

---

### WP-049 — Dashboard curation + honesty pass

- **Priority:** P2
- **Proposed:** 2026-07-07
- **Stories / Docs:** review Cluster 3 minors
- **Depends on:** WP-048
- **Estimate:** M
- **Trigger to pull:** After WP-048 lands.
- **Definition of done:** Soft-delete + undo toast (repo already supports it); pin/importance/tag editing in the TUI; dashboard search routed through FTS (delete the substring re-implementation); `context` field rendered in detail; keybinding bar handles narrow terminals; relations query debounced/cached off the keystroke path.

### WP-051 — Memory strategy arc: auto-capture, local embeddings, plugin distribution

- **Priority:** P2
- **Proposed:** 2026-07-07
- **Stories / Docs:** docs/reviews/2026-07-07-memory-review.md Cluster 4 (full competitive landscape + positioning)
- **Depends on:** WP-043, WP-044 (foundation must be honest first)
- **Estimate:** XL (must decompose before pulling)
- **Trigger to pull:** Decompose when the v1.14.0 quality sprint closes; each child is its own sprint.
- **Definition of done:** (of the decomposition) Five child WPs minted with the review's ranking: (1) auto-capture via SessionEnd/Stop hooks (extract.ts is the head start), (2) local-embedding hybrid retrieval (re-introduces sqlite-vec, wired), (3) Claude Code plugin marketplace packaging, (4) native-memory continuous interop + markdown export, (5) git-committed team memory. Positioning updated: "memory as managed, measurable infrastructure", not "Claude remembers".

### WP-041 — Enable pnpm minimumReleaseAge supply-chain guard

- **Priority:** P2
- **Proposed:** 2026-07-07
- **Stories / Docs:** pnpm `minimumReleaseAge` setting; maintainer suggestion during 2026-07-07 security patch
- **Depends on:** none
- **Estimate:** XS
- **Trigger to pull:** Next dependency-hygiene pass, or as filler.
- **Definition of done:** `minimumReleaseAge` (7 days = 10080) set in root + docs pnpm config with `minimumReleaseAgeExclude` empty; `pnpm install` still resolves cleanly; one line in `.claude/rules/conventions.md` documenting the guard and how to bypass for an urgent CVE patch (temporary exclude, not removal).

Supply-chain worm protection: newly published package versions can't enter the lockfile until they've survived N days in the wild. Was suspected during the security patch (it wasn't active); should be a deliberate yes.

---

## P3 — Parked

### WP-020 — Compute eval scenario counts instead of hand-maintaining them

- **Priority:** P3
- **Proposed:** 2026-07-01
- **Stories / Docs:** Sprint 33 code review (Minor); `src/commands/eval/index.ts` interactive suite choices; eval.mdx suite tables
- **Depends on:** none
- **Estimate:** XS
- **Trigger to pull:** Next time a scenario is added or removed, or as filler.
- **Definition of done:** The interactive suite picker derives per-suite counts from `loadScenarios()` at prompt time; a test asserts the on-disk scenario counts match whatever remains hardcoded (or the hardcoded strings are gone entirely).

### WP-021 — Eval: reject meaningless fields per check type

- **Priority:** P3
- **Proposed:** 2026-07-01
- **Stories / Docs:** Sprint 33 code review (Minor); `src/commands/eval/schema.ts`
- **Depends on:** none
- **Estimate:** XS
- **Trigger to pull:** Paired with any eval schema work.
- **Definition of done:** Schema rejects `expect` on `custom`/`judge` checks (silently ignored today) with a clear error; docs table updated.

### WP-022 — Single gist probe per sync invocation

- **Priority:** P3
- **Proposed:** 2026-07-01
- **Stories / Docs:** Sprint 33 code review (Minor); `runSync` → `runPull` → `runPush` each call `loadSyncConfig()` (up to 3 `gh` probes per sync)
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** If users report slow `memory sync`, or paired with any sync work.
- **Definition of done:** One `loadSyncConfig()` resolution per CLI invocation (pass the config down or memoize per process); sync behavior unchanged; tests stay green.

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
- **2026-05-04:** Added WP-010 (test `async: true` vs nohup wrapper for SessionEnd memory push) and WP-011 (replace inline shell guards with `if:` syntax in PreToolUse hooks) to P2 after a hook-API audit confirmed the rest of our generators are on the current spec.
- **2026-05-04:** WP-012 minted as P0 + pulled into Sprint 32 same edit. Hook audit on wastd surfaced that every PreToolUse/PostToolUse hook our CLI ships reads non-existent `$TOOL_INPUT_*` env vars and silently no-ops. Plan at `docs/superpowers/plans/2026-05-04-hook-stdin-input-bug.md`. Retracts the "all current" claim from the prior audit memo.
- **2026-05-04:** Added WP-013 (settings.local.json fixer gap from Sprint 32 code review) and WP-014 (consolidate same-matcher hook entries — we ship the bug we just documented in `hooks.md`) to P1.
- **2026-07-01:** WP-015..WP-019 minted from external project review (3.5/5 → path to 5/5). P0: WP-015 (stop stripping the sandbox — scope it), WP-016 (canary CI against latest real Claude Code). P1: WP-017 (eval custom/transcript/judge checks), WP-018 (intent-based checks replace template heuristics), WP-019 (cross-machine sync becomes the flagship memory story — repositioning, not spin-off, per maintainer feedback).
- **2026-07-01:** WP-015, WP-016, WP-017, WP-018, WP-019 pulled into Sprint 33 (the 5/5 arc, single combined sprint). Sequencing note removed with the pull.
- **2026-07-01:** Sprint 33 closed. WP-015, WP-016, WP-017, WP-018, WP-019 done (v1.11.0). Code review: 2 Critical + 5 Important fixed in-sprint; 3 Minor findings filed as WP-020..WP-022 (P3).
- **2026-07-02:** WP-023..WP-035 minted from the template-workflow review (11-agent panel: 3 readers, 3 ecosystem researchers, 5 judges) and pulled into Sprint 34 in the same edit, plus WP-014 pulled from P1. Theme: the enforcement layer must stop being decorative — warnings reach the model, phantom PostCompact replaced, dead/false-positive triggers fixed, review gate delegates to native /code-review, Stop-and-Swarm modernized, dangling references resolved, jq preflight, superpowers detect-and-recommend, reviewer subagent, dependency-aware pulls, batch invariants into doctor.
- **2026-07-02:** Sprint 34 closed. WP-014, WP-023..WP-035 done (v1.12.0). Review: 1 Critical (PostCompact exists — side-effect-only; fixer gated) + 2 Important (stale-hook migration path, Sprint 32 nudge rewrite) fixed in-sprint.
- **2026-07-07:** WP-036 (P1, regression suite red on dev machine), WP-039 (P1, sub-agent briefs in Stop-and-Swarm), WP-040 (P1, Key Decisions why-log), WP-042 (P1, force-push hook false positive), WP-041 (P2, minimumReleaseAge guard) minted from session 49 (Fable Mode v2 gap analysis + security patch fallout). WP-037, WP-038 minted as P0 and pulled into Sprint 35 in the same edit (verification discipline arc: generated verification rule + doctor check/fixer + premature-victory eval scenario); scope + DoD live in the sprint plan.
- **2026-07-07:** Sprint 35 closed. WP-037, WP-038 done (v1.13.0). Review: 0 Critical, 2 Important (dead scenario `runs` field now honored; landing-page scenario count) fixed in-sprint.
- **2026-07-07:** WP-036, WP-043 pulled into Sprint 36 (v1.13.0 publish gate).
- **2026-07-07:** WP-044..WP-047 pulled into Sprint 37 (v1.14.0 honest-memory core) and completed same session.
- **2026-07-08:** WP-050 pulled into Sprint 38 (make the benchmark gate real or cut it).
- **2026-07-08:** Sprint 40 closed. WP-048 done (v1.16.0). Review: 2 Important fixed in-sprint (modal guard, index reconciliation).
- **2026-07-08:** WP-048 pulled into Sprint 40 (dashboard find-then-act).
- **2026-07-08:** Sprint 39 closed. WP-013, WP-039, WP-040, WP-042, WP-052 done (v1.15.0). Review: 2 Important fixed in-sprint.
- **2026-07-08:** WP-013, WP-039, WP-040, WP-042, WP-052 pulled into Sprint 39 (guards and templates that tell the truth). WP-048 deliberately kept separate (M-sized, own test infra).
- **2026-07-08:** Canary issue #7 closed as false alarm: workflow referenced a nonexistent ANTHROPIC_API_KEY secret since birth — never passed in CI until today. Fixed (OAuth secret + loud infra preflight); first green run on Claude Code 2.1.204, all 5 assertions.
- **2026-07-08:** v1.14.0 published to npm (folds unreleased 1.13.0). WP-052 minted (publish hook celebrates failed publishes).
- **2026-07-08:** Sprint 38 closed. WP-050 done — mutation panel 4/4 red, healthy 59/59 green. Review: 2 Important fixed in-sprint.
- **2026-07-08:** WP-050 promoted P2→P1 with mutation-test evidence: retrieval + injection benchmarks pass with text relevance zeroed and injection scoring gutted — they don't constrain the headline algorithms. Decay, diversity, and scale benches proven real (mutations caught).
- **2026-07-07:** Sprint 37 closed. WP-044..WP-047 done (v1.14.0). Review: 2 Critical (migration bricked existing installs; sync compounding) + 4 Important — all fixed in-sprint with legacy-DB fixture tests.
- **2026-07-07:** Sprint 36 closed. WP-036, WP-043 done. Review: 5 Important fixed in-sprint (field migration for bare hooks, no-op --fix removed, pull --all exit code, duplicate matcher, CHANGELOG).
- **2026-07-07:** WP-043..WP-051 minted from the 4-agent memory deep review (core+algorithms, CLI UX, dashboard TUI, competitive landscape) — see docs/reviews/2026-07-07-memory-review.md. P0: WP-043 (CLI exits 0 on failure/crash), WP-044 (decay compounds per session, 37% over-decay verified). P1: WP-045 (dead sqlite-vec native dep), WP-046 (global content_hash), WP-047 (promised secret detection missing), WP-048 (dashboard find-then-act broken). P2: WP-049, WP-050, WP-051 (strategy arc: auto-capture, local embeddings, plugin distribution).
