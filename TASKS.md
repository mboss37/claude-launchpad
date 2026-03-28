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
- **Sprint 6**: Community — v0.2.2, plugin submitted, docs page, privacy policy, 50 tests, 60KB package, -v flag

## Current Sprint: Sprint 7 — Grow

### In Progress

### To Do
- [ ] Smart init — use Claude to generate project-specific hooks based on codebase analysis
- [ ] MCP server recommendations — "you have Postgres but no database MCP server"
- [ ] Config diff in GitHub Action output (before/after score comparison)
- [ ] More test coverage for fixer.ts and runner.ts
- [ ] doctor --fix should also generate .claudeignore when missing

### Done

## Upcoming
- **Sprint 8**: Community scenario packs, leaderboard, plugin marketplace analytics

## Session Log
### 2026-03-28 (session 2)
- Single-pass --fix, 48 tests, GitHub Action, Agent SDK eval runner, code review process
### 2026-03-28 (session 3)
- v0.2.2 published. Plugin submitted. Docs page. Privacy policy. 60KB package. -v flag.
- Smarter settings analyzer (plugins=info, permissions context-aware). Self-scores 93%.
- Tested eval on real project (hyperterminal): 94%. Tested doctor --watch + --fix live: 70%→93%.
