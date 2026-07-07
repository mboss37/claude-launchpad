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

## P0 — Memory review fallout (see docs/reviews/2026-07-07-memory-review.md)

### WP-043 — Memory CLI stops lying about success

- **Priority:** P0
- **Proposed:** 2026-07-07
- **Stories / Docs:** docs/reviews/2026-07-07-memory-review.md Cluster 1
- **Depends on:** none
- **Estimate:** M
- **Trigger to pull:** Before or with the v1.13.0 publish (the exit-code subset is S and gate-worthy).
- **Definition of done:** Bare `memory` has a non-TTY guard (mirror install.ts:75) and exits 1 on failure; all sync `log.error + return` paths set `process.exitCode = 1` (pull no-gist/no-project/no-remote-file, push no-project, sync status/clean no-gist); `memory stats` and `memory doctor` are registered subcommands (doctor.ts already exists, wire it); unknown subcommands get a helpful hint; `context --json` either emits real JSON or the flag is removed from command + generated hook; all three generated memory hooks use the same `npx claude-launchpad` invocation; extract.ts/search.ts wired or deleted; architecture.md matches reality; memory.mdx exit-code claims true.

The headline command crashes with exit 0 in CI, sync failures masquerade as success, and the most natural subcommand guesses error cryptically while complete implementations sit unregistered.

### WP-044 — Decay must be a pure function of age, not session count

- **Priority:** P0
- **Proposed:** 2026-07-07
- **Stories / Docs:** review Cluster 2.1; decay-service.ts:133, context.ts:48
- **Depends on:** none
- **Estimate:** M
- **Trigger to pull:** Next memory sprint (v1.14.0).
- **Definition of done:** Migration adds immutable `base_importance`; decay computes `base * decayFactor(age)` so N session-starts produce identical importance to 1 (idempotency benchmark added); existing stores migrated (current importance becomes base); `pnpm bench:memory` green with thresholds updated + documented.

Verified empirically: 23 session-starts over-decay a day-30 memory by 37% vs its own formula. Active users get punished hardest — the opposite of the model's intent.

---

## P1 — Soon (within 2–3 sprints)

### WP-045 — Delete memory dead weight (incl. the sqlite-vec native dep)

- **Priority:** P1
- **Proposed:** 2026-07-07
- **Stories / Docs:** review Cluster 2.2/2.6
- **Depends on:** none
- **Estimate:** M
- **Trigger to pull:** With WP-044 (same migration window).
- **Definition of done:** `memories_vec` table, `embedding` column, sqlite-vec load + dependency removed (migration); dead error helpers (`withRetry`/`isSqliteBusy`/unused templates), dead config knobs (`enableReranker`, `accessModifiers`), duplicate `ConsolidationService.prune` deleted; consolidation dedup O(n) via normalized-hash grouping; install/docs mention only better-sqlite3. If/when local embeddings ship (WP-051), sqlite-vec returns deliberately and wired.

The vector layer is 100% dead but forces users to install a second native dep. Deleting it halves install friction today.

### WP-046 — content_hash dedup scoped per project + honest sync counts

- **Priority:** P1
- **Proposed:** 2026-07-07
- **Stories / Docs:** review Cluster 2.3; migrations/003:26, sync-merge.ts:74
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** With WP-044 (same migration window).
- **Definition of done:** Unique index becomes `(content_hash, project)`; `inserted++` gated on `result.changes`; regression tests: same content in two projects both stored; sync of same-content/different-id rows reports accurate counts.

### WP-047 — Secret detection in memory_store (the docs already promise it)

- **Priority:** P1
- **Proposed:** 2026-07-07
- **Stories / Docs:** review Cluster 2.4; content-validation.ts
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** Next memory sprint — memories sync to GitHub Gists, this is a leak path.
- **Definition of done:** content-validation rejects/redacts key-shaped content (`sk-`, `AKIA`, `-----BEGIN`, `password=`, high-entropy tokens); tests with true/false positives; memory.md rule claim becomes true.

### WP-048 — Dashboard: make find-then-act work

- **Priority:** P1
- **Proposed:** 2026-07-07
- **Stories / Docs:** review Cluster 3; app.tsx:128, use-keybindings.ts:37-59
- **Depends on:** none
- **Estimate:** M
- **Trigger to pull:** Next memory sprint.
- **Definition of done:** Search submit keeps the filter and returns keyboard to the list (search → j/k → expand/delete works); Tab either routes keys by focused pane or is removed; relations show titles not UUIDs; selectedIndex clamps when the list narrows; `d` no longer means purge-project (move to X; d/r = single item); error boundary restores the terminal; interaction tests via ink-testing-library.

### WP-036 — Regression suite fails 13/21 on dev machine

- **Priority:** P1
- **Proposed:** 2026-07-07
- **Stories / Docs:** memory `a2eb8c7c` (session 49); `tests/regression/doctor-regression.sh`
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** Before the next release publish, or any sprint touching the regression suite.
- **Definition of done:** Root cause identified for why S3/S4/S5/S6/S8/S9 (all memory/MCP scenarios) fail on the dev Mac but pass 21/21 in a fresh container. Proven NOT caused by ~/.claude.json user scope (fails with isolated HOME) and NOT by the 2026-07-07 dep patch (identical failures on pre-patch HEAD). Suite passes locally, or machine-specific preconditions are detected and reported explicitly instead of failing.

The regression suite silently rotted on the dev machine — it was only ever verified green in containers. A suite that can't run where development happens doesn't gate anything.

### WP-039 — Sub-agent briefing structure in generated Stop-and-Swarm

- **Priority:** P1
- **Proposed:** 2026-07-07
- **Stories / Docs:** `../templates/fable-mode-v2.md` (Sub-Agent System); session 49 gap analysis (Gap 2)
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** Next template-content sprint.
- **Definition of done:** Generated Stop-and-Swarm section (`src/lib/sections.ts`) includes the 5-part agent brief template (Mission / Context / Scope fence / Return format / Evidence rule) and the "treat sub-agent output as testimony — spot-check load-bearing claims before building on them" rule. Repo's own `.claude/rules/conventions.md` Parallel Agents section gets the same. Generator tests updated.

Stop-and-Swarm names agent roles but gives no brief structure, so swarm agents get vague prompts and their findings get forwarded unverified — the two failure modes the Fable Mode v2 sub-agent system exists to kill.

### WP-040 — Key Decisions why-log discipline

- **Priority:** P1
- **Proposed:** 2026-07-07
- **Stories / Docs:** `../templates/fable-mode-v2.md` (DECISIONS.md format); session 49 gap analysis (Gap 3)
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** Next template-content sprint, or paired with WP-039.
- **Definition of done:** Generated `## Key Decisions` section ships the append-only entry format (`YYYY-MM-DD — Chose X over Y because Z. Revisit if W.`) plus a write-when-decided rule instead of the bare HTML placeholder. Doctor LOW finding when Key Decisions is still placeholder-only in a repo with 20+ commits. Generator + analyzer tests.

The current placeholder produces empty sections in the field — a decision log nobody writes to at decision time never gets written.

### WP-042 — Force-push hook false-positives on unrelated commands

- **Priority:** P1
- **Proposed:** 2026-07-07
- **Stories / Docs:** hit live in session 49: `git stash push -- … && pnpm install --frozen-lockfile` was exit-2 blocked by `push.*--force|push.*-f`
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** Next sprint touching `settings.ts` generation or hooks.
- **Definition of done:** The destructive-command guard matches actual `git push` force invocations only (anchored on `git push` + word-boundary `--force|--force-with-lease|-f`), not any command containing "push" followed by a token starting with `-f`. Updated in `src/commands/init/generators/settings.ts`, this repo's own `.claude/settings.json`, and covered by tests listing the known false positives (`git stash push … --frozen-lockfile`, `pnpm install --force` alone) and true positives.

A guard that blocks legitimate commands trains users to bypass it — false positives are how security hooks die.

### WP-013 — Extend `rewriteEnvVarHooks` to also patch `settings.local.json`

- **Priority:** P1
- **Proposed:** 2026-05-04
- **Stories / Docs:** Sprint 32 code review (Important #2); `src/commands/doctor/fixer-hook-input.ts:115-127`
- **Depends on:** none
- **Estimate:** XS
- **Trigger to pull:** Anytime `fixer-hook-input.ts` is touched, or as filler.
- **Definition of done:** `rewriteEnvVarHooks(root)` reads/writes `settings.local.json` via `readSettingsLocalJson`/`writeSettingsLocalJson` in addition to `settings.json`. Test asserts a project with the bug ONLY in `settings.local.json` gets fixed by `doctor --fix`.

The Sprint 32 fixer covers `settings.json` but the parser flags env-var hooks in either file. If a user added a custom env-var hook to `settings.local.json`, doctor reports the issue, claims it fixed it, but actually didn't touch the local file. Two-line addition.


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

## P3 — Parked

### WP-049 — Dashboard curation + honesty pass

- **Priority:** P2
- **Proposed:** 2026-07-07
- **Stories / Docs:** review Cluster 3 minors
- **Depends on:** WP-048
- **Estimate:** M
- **Trigger to pull:** After WP-048 lands.
- **Definition of done:** Soft-delete + undo toast (repo already supports it); pin/importance/tag editing in the TUI; dashboard search routed through FTS (delete the substring re-implementation); `context` field rendered in detail; keybinding bar handles narrow terminals; relations query debounced/cached off the keystroke path.

### WP-050 — Memory benchmarks measure what they claim

- **Priority:** P2
- **Proposed:** 2026-07-07
- **Stories / Docs:** review Cluster 2.5; injection-quality.bench.ts:96-158
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** With any memory algorithm change (bench gate must be honest first).
- **Definition of done:** Oracle knapsack optimizes the same per-memory score the packer uses, threshold raised from 0.3 to a meaningful bound; noise-penalty test gets its missing assertion; git-path injection score normalized to ≤1.0; accessCount split into surfaced vs used (or incremented only on direct-ID lookup).

### WP-051 — Memory strategy arc: auto-capture, local embeddings, plugin distribution

- **Priority:** P2
- **Proposed:** 2026-07-07
- **Stories / Docs:** docs/reviews/2026-07-07-memory-review.md Cluster 4 (full competitive landscape + positioning)
- **Depends on:** WP-043, WP-044 (foundation must be honest first)
- **Estimate:** XL (must decompose before pulling)
- **Trigger to pull:** Decompose when the v1.14.0 quality sprint closes; each child is its own sprint.
- **Definition of done (of the decomposition):** Five child WPs minted with the review's ranking: (1) auto-capture via SessionEnd/Stop hooks (extract.ts is the head start), (2) local-embedding hybrid retrieval (re-introduces sqlite-vec, wired), (3) Claude Code plugin marketplace packaging, (4) native-memory continuous interop + markdown export, (5) git-committed team memory. Positioning updated: "memory as managed, measurable infrastructure", not "Claude remembers".

### WP-041 — Enable pnpm minimumReleaseAge supply-chain guard

- **Priority:** P2
- **Proposed:** 2026-07-07
- **Stories / Docs:** pnpm `minimumReleaseAge` setting; maintainer suggestion during 2026-07-07 security patch
- **Depends on:** none
- **Estimate:** XS
- **Trigger to pull:** Next dependency-hygiene pass, or as filler.
- **Definition of done:** `minimumReleaseAge` (7 days = 10080) set in root + docs pnpm config with `minimumReleaseAgeExclude` empty; `pnpm install` still resolves cleanly; one line in `.claude/rules/conventions.md` documenting the guard and how to bypass for an urgent CVE patch (temporary exclude, not removal).

Supply-chain worm protection: newly published package versions can't enter the lockfile until they've survived N days in the wild. Was suspected during the security patch (it wasn't active); should be a deliberate yes.

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
- **2026-07-07:** WP-043..WP-051 minted from the 4-agent memory deep review (core+algorithms, CLI UX, dashboard TUI, competitive landscape) — see docs/reviews/2026-07-07-memory-review.md. P0: WP-043 (CLI exits 0 on failure/crash), WP-044 (decay compounds per session, 37% over-decay verified). P1: WP-045 (dead sqlite-vec native dep), WP-046 (global content_hash), WP-047 (promised secret detection missing), WP-048 (dashboard find-then-act broken). P2: WP-049, WP-050, WP-051 (strategy arc: auto-capture, local embeddings, plugin distribution).
