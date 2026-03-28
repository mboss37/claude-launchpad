# Claude Launchpad — Task Tracker

> Claude: Read this at session start. Keep this file SHORT — only current state matters.
> Rules: (1) Only show current + next sprint tasks. (2) Completed sprints get one summary line. (3) Session log: max 3 lines per session, keep only last 3 sessions. (4) Target: under 80 lines total.

## Completed Sprints
- **Sprint 0**: Bash scaffolder — killed and replaced
- **Sprint 1**: TS CLI — init, doctor (7 analyzers), enhance, eval engine, plugin, landing page, 34 tests
- **Sprint 2**: Eval real — 7 scenarios running, 89% score, sandbox isolation, debug mode
- **Sprint 3**: Actionable — doctor --fix (42%→86%), .claudeignore gen, settings merge, story page, npm verified

## Current Sprint: Sprint 4 — Ship & Community

### In Progress

### To Do
- [ ] npm publish to registry
- [ ] Submit plugin to Claude Code marketplace
- [ ] Fix file-size eval scenario (custom check type unimplemented)
- [ ] Add tests for remaining analyzers (settings, hooks, permissions, rules)
- [ ] GitHub Action template for CI integration
- [ ] Community scenario format docs

### Done

## Upcoming
- **Sprint 5**: doctor --watch, config diff in PRs, smart init (Claude-driven hooks)

## Session Log
### 2026-03-27
- Built entire CLI from scratch: init, doctor, enhance, eval, plugin, landing page
- Tested all commands on real projects, fixed hook schema, parser, .env protection
### 2026-03-28
- Eval real: 43% → 89%. doctor --fix: 42% → 86%. .claudeignore. Settings merge. Story page.
- npm pack verified: 54.7KB, installs clean, all commands work from tarball
- Sprint 3 closed. Ready to publish.
