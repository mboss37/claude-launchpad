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
- **Sprint 27**: Memory MCP unblock + sandbox kill (v1.7.0) — Fixed the actual cause of `/mcp ✘ failed`: `server.ts` was calling `startServer()` at module-import AND inside the CLI action handler, spawning two MCP servers on the same stdio pipe. Gated auto-start with `isMainEntry()` via `import.meta.url` + `realpathSync(process.argv[1])`. Separately removed the filesystem sandbox from init (it blocked memory MCP from reading ~/.agentic-memory/memory.db); doctor now flags `sandbox.enabled === true` as HIGH and strips it on `--fix`. Renamed eval scenario `sandbox-escape` → `env-exfil-bash` (always was a .env exfil test, never actually tested the sandbox). Bumped skill v8. 398 tests.

## Current Sprint: none — pick next from BACKLOG.md

## Session Log
### 2026-04-22 (session 42)
- v1.7.2 bugfix: SessionEnd push hook was synchronous — Claude Code SIGTERM'd it before the ~3s GitHub push completed. Wrapped in `nohup ... </dev/null >/dev/null 2>&1 & exit 0` so it detaches and survives. Analyzer/fixer/install all updated; 3 existing projects patched in place.
- 399 tests (+1), typecheck + build green. Explore-agent review clean.

### 2026-04-21 (session 41)
- v1.7.1 bugfix: stale sync-config self-heal + git stderr leak. `readGistFile`/`listGistFiles` silently 404'd against a deleted gist, making `pull`/`pull --all`/`sync status` report empty remote even when the real gist had memories. `loadSyncConfig()` now probes via `gh api --silent`, distinguishes 404 from transient errors, and re-runs discovery on dead gists.
- Second fix: `git diff HEAD~5` stderr now pipes instead of leaking `fatal:` lines on fresh repos (SessionStart hook was masking with `2>/dev/null`; manual invocations weren't).
- 398 tests, 57 benchmarks, typecheck + build green. Explore-agent review clean. Docs/CHANGELOG updated.

### 2026-04-19 (session 40)
- Sprint 27 shipped: killed the filesystem sandbox feature AND fixed the real MCP blocker — double-spawned server. Debug log revealed `Received a response for an unknown message ID: {"id":0,...}` caused by auto-start firing at both module-import and CLI action time. Gated with `isMainEntry()`.
- Patched 6 local projects' settings.json to remove sandbox blocks. BACKLOG cleaned of wrong hypotheses (npx-PATH and trust-wiring — both were red herrings next to the actual double-spawn).
- 398 tests, build green, both code and content reviews clean. Ready to publish v1.7.0.

### 2026-04-18 (session 39)
- Sprint 26 shipped: MMR diversity re-ranking in InjectionService. Non-pinned scope, λ=0.7, 60/40 content+tag Jaccard. Extracted shared similarity primitives (utils/similarity.ts), added pure applyMMR module (utils/mmr.ts).
- New diversity benchmark: under crowded scoring (one cluster dominant), baseline top-5 collapses to 1 topic, MMR expands to 5 (Δ+4). 399 tests (+27), 57 benchmarks (+3), oracle still 71.7%.
- Removed dead `lint` script from package.json (referenced uninstalled eslint, was blocking post-edit hook). Published v1.6.0.

