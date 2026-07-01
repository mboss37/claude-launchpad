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

### WP-015 — Scope the filesystem sandbox instead of stripping it

- **Priority:** P0
- **Proposed:** 2026-07-01
- **Stories / Docs:** Sprint 27 (sandbox kill); `src/commands/doctor/analyzers/permissions.ts:44-52`; 2026-07-01 external project review (Critical finding)
- **Depends on:** none
- **Estimate:** M
- **Trigger to pull:** Next sprint — this is a security-credibility issue for a tool that markets itself as a config security linter.
- **Definition of done:** Doctor no longer flags `sandbox.enabled: true` as HIGH nor strips the block on `--fix`. Investigate the current sandbox scoping mechanism (e.g. `permissions.additionalDirectories` or sandbox allow rules) and confirm whether `~/.agentic-memory` can be granted while the sandbox stays on. If scoping works: analyzer flags only sandboxes that block memory MCP paths, and the fixer ADDS the scoped grant instead of removing the sandbox; validate end-to-end that memory MCP reads `memory.db` with sandbox enabled. If scoping is genuinely impossible: downgrade to a MEDIUM informational finding with a docs link explaining the tradeoff — never auto-remove. Analyzer + fixer + regression tests updated either way.

Sprint 27 made doctor treat a first-party security feature as a HIGH issue and auto-remove it because it broke our own memory MCP. A security linter must never disable a platform safety feature for its own convenience — scope it correctly or explain the tradeoff, but don't strip it.

### WP-016 — Canary CI: run generated config against latest real Claude Code weekly

- **Priority:** P0
- **Proposed:** 2026-07-01
- **Stories / Docs:** Sprint 32 (hook stdin bug — generated hooks were silently inert for months); 2026-07-01 external project review
- **Depends on:** none
- **Estimate:** L
- **Trigger to pull:** Next sprint or the one after — this is the structural fix for the rot class that caused the Sprint 32 P0.
- **Definition of done:** A GitHub Actions workflow (weekly cron + manual dispatch) that: scaffolds a temp project with `init -y`, installs the LATEST released `claude` CLI, then runs headless sessions asserting real behavior — (1) the destructive-Bash PreToolUse hook actually blocks `rm -rf /`, (2) the `.env` read guard actually blocks, (3) a PostToolUse hook actually fires (observable side effect), (4) `claude mcp list` shows agentic-memory registered after `memory install`, (5) SessionStart memory context injection produces output. Any failure opens a labeled GitHub issue automatically. Requires an `ANTHROPIC_API_KEY` repo secret; document the (small) cost per run.

The Sprint 32 bug proved generated configs can be silently dead for months while unit tests stay green — unit tests validate what we *emit*, not what Claude Code *executes*. A weekly canary against the real, latest CLI turns "we track the spec closely" from best-effort into a guarantee, and is what makes a config linter sustainable for a solo maintainer.

---

## P1 — Soon (within 2–3 sprints)

### WP-013 — Extend `rewriteEnvVarHooks` to also patch `settings.local.json`

- **Priority:** P1
- **Proposed:** 2026-05-04
- **Stories / Docs:** Sprint 32 code review (Important #2); `src/commands/doctor/fixer-hook-input.ts:115-127`
- **Depends on:** none
- **Estimate:** XS
- **Trigger to pull:** Anytime `fixer-hook-input.ts` is touched, or as filler.
- **Definition of done:** `rewriteEnvVarHooks(root)` reads/writes `settings.local.json` via `readSettingsLocalJson`/`writeSettingsLocalJson` in addition to `settings.json`. Test asserts a project with the bug ONLY in `settings.local.json` gets fixed by `doctor --fix`.

The Sprint 32 fixer covers `settings.json` but the parser flags env-var hooks in either file. If a user added a custom env-var hook to `settings.local.json`, doctor reports the issue, claims it fixed it, but actually didn't touch the local file. Two-line addition.

### WP-014 — Consolidate same-matcher hook entries in `settings.ts`

- **Priority:** P1
- **Proposed:** 2026-05-04
- **Stories / Docs:** Sprint 32 code review (Minor #1); `.claude/rules/hooks.md` (the rule we just shipped); `src/commands/init/generators/settings.ts:32-95`
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** Next time `init` settings are touched.
- **Definition of done:** `settings.ts` emits ONE `PreToolUse Bash` entry combining the destructive-cmd block + `sprint-open-check.sh` into the same `hooks` array, and ONE `PostToolUse Edit|Write` entry combining auto-format + sprint-complete + workflow-check (matcher strings normalized). Same-matcher consolidation also applied in `addHookToSettings` so subsequent fixers append into existing entries rather than creating new ones. Regression test asserts no duplicate matchers in generated settings.

The newly shipped `hooks.md` rule warns that multiple top-level entries with the same matcher can fail. Our own generators emit exactly that pattern (2x `Bash` PreToolUse, 3x `Edit|Write` PostToolUse). Shipping the bug we just documented.

### WP-017 — Eval depth: implement `custom` checks + transcript assertions + judge

- **Priority:** P1
- **Proposed:** 2026-07-01
- **Stories / Docs:** `src/commands/eval/runner.ts:239` (`custom` returns `false` unconditionally); 2026-07-01 external project review
- **Depends on:** none
- **Estimate:** L
- **Trigger to pull:** After WP-015/WP-016 ship — eval is the differentiator, this is where the 5/5 lives.
- **Definition of done:** Three new working check types, each with schema + loader + runner support, docs, and at least one built-in scenario using it: (1) `custom` — executes a user-provided script inside the sandbox, exit code 0 = pass; (2) `transcript` — captures the session via `--output-format stream-json` (SDK message stream when available) and asserts on behavior, e.g. "hook X fired", "tool Y was never used", "rule file Z was read" — artifacts alone can't prove Claude *followed the process*; (3) `judge` — sends the transcript + a rubric to a Claude call and scores pass/fail with reasoning (eval already costs money, so no new constraint violated). `pnpm test:run` covers schema validation and check evaluation for all three; runner keeps its CLI fallback path working.

Today eval only greps final file artifacts, which proves the *outcome* but not the *behavior* — a scenario can pass because Claude got lucky, not because the config steered it. Transcript assertions and an LLM judge make "prove Claude follows your rules" literally true, which is the product's core claim and the thing no built-in feature does.

### WP-018 — Replace template-shaped doctor heuristics with intent-based checks

- **Priority:** P1
- **Proposed:** 2026-07-01
- **Stories / Docs:** Sprint 25 (quality-intents precedent); `src/commands/doctor/analyzers/permissions.ts` (literal `## Off-Limits` heading, `"force"` substring grep, legacy `allowedTools` key); 2026-07-01 external project review
- **Depends on:** none
- **Estimate:** M
- **Trigger to pull:** Within 2–3 sprints, or paired with any analyzer work as a modernization pass.
- **Definition of done:** Audit ALL analyzers for checks that test resemblance to our template rather than actual quality; produce the list in the sprint plan. At minimum: (1) Off-Limits literal-heading check reuses the Sprint 25 intent-detection mechanism (guardrails intent satisfied by any equivalent section); (2) force-push protection inspects hook semantics (matcher + command inspects `git push` with force flags) instead of the substring `"force"` anywhere in any command; (3) the `allowedTools` check is validated against the CURRENT settings schema and updated or removed if the key is legacy. Score changes documented; tests updated; a mature non-launchpad-shaped project (existing fixture) must not lose points for organizing things differently.

Several checks currently measure "how much your config looks like launchpad's template" — that inflates scores for our own output and penalizes well-configured projects that made different-but-valid choices. Sprint 25 already built the intent mechanism for CLAUDE.md sections; extend the same philosophy to the remaining analyzers so the score means what it claims to mean.

### WP-019 — Make cross-machine memory sync the flagship memory story

- **Priority:** P1
- **Proposed:** 2026-07-01
- **Stories / Docs:** Sprint 17 (gist sync), Sprint 23 (sync status/clean, two-machine framing), `tests/memory/two-machine-sync.test.ts`; 2026-07-01 external project review (memory positioning = biggest strategic lever)
- **Depends on:** none
- **Estimate:** M
- **Trigger to pull:** Next content-touching sprint, or paired with any memory sprint.
- **Definition of done:** (1) Positioning: landing page, docs, and README lead the memory story with cross-machine sync — the thing built-in auto-memory does NOT do — instead of competing head-on with it on "persistent memory" (Content Updates rule: all three surfaces). Include an honest "built-in memory vs agentic-memory" comparison table in docs. (2) Convenience: new `memory sync` subcommand = pull + push in one call, reusing existing pull-before-push merge logic. (3) Hardening: extend `two-machine-sync.test.ts` with a simultaneous-edit conflict case (same memory updated on both machines between syncs) asserting last-write-wins resolves deterministically and `sync status` reports it. Benchmarks stay green (`pnpm bench:memory`).

Memory is the most-used feature in practice and gist-based cross-machine sync is its genuinely defensible niche — first-party auto-memory is per-machine. Stop framing memory as an alternative to the built-in system (a race we lose by default) and frame it as the sync layer the built-in system doesn't have.

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
