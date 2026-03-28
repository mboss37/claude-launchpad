# Claude Launchpad — Task Tracker

> Claude: Read this at session start. Keep this file SHORT — only current state matters.
> Rules: (1) Only show current + next sprint tasks. (2) Completed sprints get one summary line. (3) Session log: max 3 lines per session, keep only last 3 sessions. (4) Target: under 80 lines total.

## Completed Sprints
- **Sprint 0**: Bash scaffolder — killed and replaced
- **Sprint 1**: TS CLI — init, doctor (7 analyzers), enhance, eval engine, plugin, landing page, 34 tests
- **Sprint 2**: Eval real — 7 scenarios running, 89% score, sandbox isolation, debug mode
- **Sprint 3**: Actionable — doctor --fix (42%→86%), .claudeignore gen, settings merge, story page
- **Sprint 4**: Ship — npm published (v0.1.0), stress tested 8 stacks (all pass), landing page carousel, self-scores 89%

## Current Sprint: Sprint 5 — Harden & Grow

### In Progress

### To Do
- [ ] Refactor eval runner to use Agent SDK instead of shelling out to `claude -p`
- [ ] Submit plugin to Claude Code marketplace
- [ ] Publish v0.2.0 with all Sprint 5 improvements

### Done
- [x] Single-pass --fix creates settings.json from scratch (42% → 86% in one command)
- [x] Added 14 tests for hooks, settings, permissions analyzers (48 total)
- [x] GitHub Action template for CI config quality gating
- [x] Implemented max-lines eval check type, fixed file-size scenario

## Upcoming
- **Sprint 6**: doctor --watch, config diff in PRs, community scenario packs

## Session Log
### 2026-03-27
- Built entire CLI from scratch: init, doctor, enhance, eval, plugin, landing page
- Tested all commands on real projects, fixed hook schema, parser, .env protection
### 2026-03-28
- Published to npm (v0.1.0), stress tested 8 stacks (all 76%→86%), terminal carousel
- Cleaned global config: removed ECC plugin, 28 agents, 50+ rules, .cursor hooks
- Self-diagnosed at 89%. Learned Agent SDK permissions for future eval refactor.
