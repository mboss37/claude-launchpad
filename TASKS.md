# Claude Launchpad — Task Tracker

> Claude: Read this at session start. Keep this file SHORT — only current state matters.
> Rules: (1) Only show current + next sprint tasks. (2) Completed sprints get one summary line. (3) Session log: max 3 lines per session, keep only last 3 sessions. (4) Target: under 80 lines total.

## Completed Sprints
- **Sprint 0**: Bash scaffolder — killed and replaced
- **Sprint 1**: TS CLI — init, doctor (7 analyzers), enhance, eval engine, plugin, landing page, 34 tests
- **Sprint 2**: Eval real — 7 scenarios running, 89% score, sandbox isolation, debug mode
- **Sprint 3**: Actionable — doctor --fix (42%→86%), .claudeignore gen, settings merge, story page
- **Sprint 4**: Ship — npm published (v0.1.0), stress tested 8 stacks, landing page carousel, self-scores 89%
- **Sprint 5**: Harden — Agent SDK eval runner, single-pass --fix, 48 tests, GitHub Action, code review process
- **Sprint 6**: Community — v0.2.2, plugin submitted, docs page, privacy policy, 50 tests, 60KB package
- **Sprint 7**: Smarts — v0.3.0, watcher, .claudeignore in --fix, enhance budget cap, Tech Stack, 57 tests
- **Sprint 8**: Polish — v0.3.4, security fix, 5 persona reviews, Tailwind redesign, glossary, suite filtering, eval reports, 58 tests
- **Sprint 9**: Scale — v0.4.0, enhanced init (6 files, $schema, permissions.deny, destructive cmd blocking, rules), Tailwind docs page, marketplace submissions, Reddit posts
- **Sprint 10**: Refine — v0.4.1-v0.4.3, memory management, PostCompact hook, eval sandbox fix, CHANGELOG, 71 tests
- **Sprint 11**: Security — v0.5.0, credential deny rules, sandbox, bypass disable, 5 new doctor checks, interactive eval, 91 tests
- **Sprint 12**: Smart Defaults — v0.5.1, 4 settings checks, SessionStart hook, --fix re-scan, 99 tests
- **Sprint 13**: Growth — Fumadocs migration (7 MDX pages, search, OG meta, GitHub Actions deploy), 4-persona docs review, landing page redesign
- **Sprint 14**: Memory — v0.7.5, /lp-enhance skill, agentic-memory integrated (262 tests), TUI dashboard, brain-inspired decay, zero-dep install, plugin removed
- **Sprint 15**: Smart Injection — InjectionService (6-signal scoring, 3 tiers, token-budget packing), fixed injection tracking bugs, 274 tests, docs updated
- **Sprint 16**: Backlog System — v0.10.0, BACKLOG.md in init/doctor/fix, three-file system, budget 200, MCP registration fix, content review skill, 280 tests
- **Sprint 17**: Memory Sync — v0.11.0, push/pull via private GitHub Gist, multi-file per project, auto-discovery, dedup guard, 294 tests
- **Sprint 18**: Algorithm Tuning + Ink Dashboard + Skills — v0.12.1, decay/injection/tagging tuning from 3-expert panel, blessed→Ink migration, skill rewrites (Anthropic patterns), dashboard delete, path-scoped rules in /lp-enhance
- **Sprint 19**: Memory Placement (v0.15.0) — local vs shared config routing, 28 files, 296 tests
- **Sprint 20**: Outcome-First Docs — rewrote all docs/README/landing page for value not features
- **Sprint 21**: Memory Bug Fixes — benchmark suite (54 tests), relation decay + type filter fixes
- **Sprint 22**: Purge + Doctor Modernization (v0.16.0) — TUI purge, SessionEnd/MCP checks, fixer extraction, 322 tests
- **Sprint 23**: Stability (v1.0.0) — sync status/clean, content_hash dedup, immutability fixes, 57 manual tests, 10 bugs fixed, cross-device sync framing
- **Sprint 25**: Doctor Intent Detection (v1.5.0) — keyword-based section detection replaces regex-exact heading loop, 8 FIX_TABLE entries wrap boilerplate in LP-STUB markers (stubs never satisfy intent), 360 tests (+12), mature-project + new-project fixtures, swissazan-style `## Sprint Planning` now correctly satisfies Session Start intent
- **Sprint 26**: Memory MMR Diversity (v1.6.0) — Maximal Marginal Relevance re-ranks non-pinned injection candidates so top-N spans topics instead of near-duplicates. λ=0.7, 60/40 content+tag Jaccard. New utils/similarity.ts + utils/mmr.ts (pure). 399 tests (+27), 57 benchmarks (+3). Under crowding, top-5 coverage goes 1→5 topics (Δ+4) with no oracle regression (71.7%).
- **Sprint 27**: Memory MCP unblock + sandbox kill (v1.7.0) — Fixed the actual cause of `/mcp ✘ failed`: `server.ts` was calling `startServer()` at module-import AND inside the CLI action handler, spawning two MCP servers on the same stdio pipe. Gated auto-start with `isMainEntry()` via `import.meta.url` + `realpathSync(process.argv[1])`. Separately removed the filesystem sandbox from init (it blocked memory MCP from reading ~/.agentic-memory/memory.db); doctor now flags `sandbox.enabled === true` as HIGH and strips it on `--fix`. Renamed eval scenario `sandbox-escape` → `env-exfil-bash`. Bumped skill v8. 398 tests.
- **Sprint 28**: Memory Install + Sync Reliability (v1.8.0) — Bundled 7 silent-failure bugs. New `memory install` subcommand; `isMemoryInstalled()` now requires MCP registration (.mcp.json / settings.local.json / ~/.claude.json); install patches `allowedMcpServers` allowlist before `claude mcp add`; preflight hard-fails on missing `claude`, warns on missing `gh`; `handleSyncErrors` sets `process.exitCode = 1`; gist transport stops swallowing execSync errors; new doctor HIGH check + fixer for allowlist excluding agentic-memory; sync-status remote count excludes locally-tombstoned rows. 399 tests, 57 benchmarks green.
- **Sprint 29**: Doctor Polish (v1.8.1) — init `-y` + new `--force` flag (industry-standard split, exits 1 with clear error on existing CLAUDE.md); `readSettingsJson`/`Local` return null + log.warn on corrupted JSON (14 callers updated, mutation paths bail); doctor flags orphaned `mcp__<server>__*` perm entries (reporter only); `log.warnOnce` dedupes parse-error noise. 408 tests (+9). Manually validated end-to-end.
- **Sprint 30**: Hackathon Hooks (v1.9.0) — extracted `lib/hook-builder.ts` pure primitive (`addOrUpdateHook`) + `addHookToSettings` I/O wrapper, replacing 3 duplicated dedup paths (fixer/install/fixer-memory). New `.worktreeinclude` template + MEDIUM doctor check on `.git/worktrees/` activity. Sprint hygiene: `sprint-size-check.sh` (microsprint/oversized) + `sprint-open-check.sh` (BACKLOG drift), 3 LOW doctor findings. Sprint-complete nudge on TASKS.md `[x]` flip. Item 5 (`.env` R/W/E block) was already shipped in earlier versions — audit was wrong. fixer.ts split (350 lines) → fixer-hooks.ts + fixer-sprint.ts. 415 tests (+7), validated end-to-end.

## Next Sprint: TBD

After v1.9.0 the BACKLOG has no P1 items left. v1.10.0 candidate (path-scoped rules + pre-commit-gate) is opinionated workflow work — pick up only if we want to keep building. Otherwise pivot to launch (Launch Campaign in BACKLOG.md).

## Release Plan
- **v1.8.1** ✅ shipped — Sprint 29 patch (doctor/init silent-failure fixes)
- **v1.9.0** ✅ shipped — Sprint 30 hackathon hooks (hook-builder, sprint hygiene, worktree, sprint-complete)
- **v1.10.0** = Sprint 31 candidate, path-scoped rules + pre-commit-gate workflow (opinionated, new skill — defer if launching)
- **v2.0.0** not scheduled. Reserved for the doctor plan/apply rewrite if/when we commit to it.

## Session Log
### 2026-04-27 (session 44)
- Shipped v1.8.1 (Sprint 29 — doctor/init silent-failure polish) and v1.9.0 (Sprint 30 — hackathon hooks). Sprint 29: init `--force` flag, settings parse warns, MCP orphan detection. Sprint 30: hook-builder primitive + 3-way dedup unification, sprint hygiene scripts, worktree check, sprint-complete nudge, fixer.ts split into fixer-hooks/fixer-sprint to stay under 400 lines.
- Item 5 of Sprint 30 (`.env` R/W/E block) was found already shipped — audit overcorrected. 415 tests, typecheck + build green, validated end-to-end. Initial bundle plan reversed mid-session: bug fixes shouldn't wait on feature work.

### 2026-04-23 (session 43)
- Sprint 28 shipped v1.8.0: 7 memory install/sync reliability bugs bundled in one pass. All four original P1s (half-installed detection, allowlist policy block, sync exit-0-on-failure, swallowed gist errors) plus 3 P2 ride-alongs (preflight, doctor allowlist check, sync-status tombstone accounting).
- 399 tests, 57 benchmarks, typecheck + build green. Explore-agent review clean (one LOW nit on sync-status filter semantics addressed via inline comment).

### 2026-04-22 (session 42)
- v1.7.2 bugfix: SessionEnd push hook was synchronous — Claude Code SIGTERM'd it before the ~3s GitHub push completed. Wrapped in `nohup ... </dev/null >/dev/null 2>&1 & exit 0` so it detaches and survives. Analyzer/fixer/install all updated; 3 existing projects patched in place.
- 399 tests (+1), typecheck + build green. Explore-agent review clean.

