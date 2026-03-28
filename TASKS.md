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
- **Sprint 7**: Smarts — v0.3.0, watcher polling, .claudeignore in --fix, enhance budget cap, Tech Stack support, 57 tests

## Current Sprint: Sprint 8 — Harden the Base

### In Progress

### To Do
- [ ] Refactor: deduplicate fileExists/readFileOrNull across 4 files (use fs-utils.ts)
- [ ] Refactor: consolidate report rendering (doctor/index.ts + watcher.ts)
- [ ] Refactor: tryFix() 73 lines → lookup table pattern
- [ ] Refactor: detectScripts() 112 lines → config object

### Done
- [x] Security fix: command injection in hook generation (v0.3.1)
- [x] 3-perspective review (simplicity, security, docs) — all critical/high issues resolved
- [x] Enhance suggests project-specific hooks (AI-driven)
- [x] 2 new eval scenarios: session-continuity, naming-conventions (11 total)
- [x] All docs updated: 11 scenarios, 57 tests, plugin v0.3.0, consistent everywhere
- [x] Landing page: simplified tags, fixed carousel layout shift, CSS McLovin

## Upcoming
- **Sprint 9**: Community scenario packs, plugin marketplace go-live

## Session Log
### 2026-03-28 (session 3)
- v0.2.2 published. Plugin submitted. Docs page. Privacy policy. 60KB package.
### 2026-03-28 (session 4)
- .claudeignore in --fix, MCP AI-driven recs, enhance budget cap, 57 tests, self-scores 93%
### 2026-03-28 (session 5)
- Security fix v0.3.1 (command injection). 3-agent review. 11 eval scenarios. CSS McLovin.
- Simplified landing page tags, fixed carousel shift, enhance suggests hooks + MCP servers.
