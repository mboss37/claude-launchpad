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

## Completed: Sprint 19 — Memory Placement (v0.15.0)
Local vs shared config routing for memory setup. 28 files, 296 tests, docs updated.

## Current: No active sprint
All planned work complete. Future features in BACKLOG.md.

## Session Log
### 2026-04-05 (session 21)
- Sprint 17: Memory sync via private GitHub Gist (push/pull, multi-file per project, auto-discovery).
- Fixed dedup bug (parallel MCP calls), refactored fixer.ts + runner.ts, 294 tests.
- Published v0.11.0. Tested cross-device sync between Mac Mini and MacBook.
### 2026-04-06 (session 22)
- Sprint 18: Ink migration, algorithm tuning (3-expert panel), skill rewrites (Anthropic patterns), dashboard delete.
- Memory sync v0.11.0 shipped + tested cross-device. Path-scoped rules in /lp-enhance. Content review fixes.
- Published v0.12.0 + v0.12.1.
### 2026-04-06 (session 23-24)
- Fix: memory retrieval truncation (500 char slice), store Zod max removal, MCP server version from package.json.
- Feat: /lp-enhance eval scenario gen + .claudeignore review + skill auto-update via doctor --fix. Karpathy-inspired copy rewrite. SEO pass.
- Published v0.12.2, v0.13.0, v0.13.1, v0.14.0.
### 2026-04-06 (session 25-26)
- Fix: doctor --fix injected memory guidance into CLAUDE.md on non-memory projects (v0.14.3).
- Feat: Memory placement — interactive local vs shared config routing. Parser reads both files, analyzers check both, fixer routes writes based on placement.
- Published v0.14.3, v0.15.0.
