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

## Current Sprint: Sprint 7 — Smarts

### In Progress

### To Do
- [ ] Smart init — use Claude to generate project-specific hooks based on codebase analysis
- [ ] Config diff in GitHub Action output (before/after score comparison)
- [ ] Publish v0.3.0

### Done
- [x] doctor --fix generates .claudeignore when missing
- [x] Doctor detects missing .claudeignore in rules analyzer
- [x] 7 fixer tests (57 total)
- [x] MCP analyzer recommends servers based on detected stack
- [x] Enhance prompt respects instruction budget (120 cap, overflow to rules/)

## Upcoming
- **Sprint 8**: Community scenario packs, plugin marketplace analytics

## Session Log
### 2026-03-28 (session 2)
- Single-pass --fix, 48 tests, GitHub Action, Agent SDK eval runner, code review process
### 2026-03-28 (session 3)
- v0.2.2 published. Plugin submitted. Docs page. Privacy policy. 60KB package.
### 2026-03-28 (session 4)
- .claudeignore in --fix, MCP recommendations, enhance budget cap, 57 tests, self-scores 93%
