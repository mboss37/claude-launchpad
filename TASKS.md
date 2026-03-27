# Claude Launchpad — Task Tracker

> Claude: Read this at session start. Keep this file SHORT — only current state matters.
> Rules: (1) Only show current + next sprint tasks. (2) Completed sprints get one summary line. (3) Session log: max 3 lines per session, keep only last 3 sessions. (4) Target: under 80 lines total.

## Completed Sprints
- **Sprint 0**: Bash scaffolder — killed and replaced
- **Sprint 1**: TS CLI — init, doctor (7 analyzers), enhance, eval engine, plugin, landing page, 34 tests
- **Sprint 2**: Eval real — 7 scenarios running, 89% score, sandbox isolation, debug mode, path resolution fixed

## Current Sprint: Sprint 3 — Make It Actionable

### In Progress

### To Do
- [ ] `doctor --fix` — auto-apply deterministic fixes (add hooks, .claudeignore, Off-Limits section)
- [ ] Init should merge with existing settings.json, not overwrite
- [ ] Fix file-size scenario (custom check type unimplemented)
- [ ] Add tests for remaining analyzers (settings, hooks, permissions, rules)
- [ ] Generate `.claudeignore` in init (node_modules, dist, __pycache__, etc.)
- [ ] npm publish dry run — verify package works via npx

### Done

## Upcoming
- **Sprint 4**: npm publish, plugin marketplace, community scenario packs

## Session Log
### 2026-03-27
- Built entire CLI from scratch: init, doctor, enhance, eval, plugin, landing page
- Tested all commands on real projects, fixed hook schema, parser, .env protection
### 2026-03-28
- Made eval real: fixed runner (drop --bare, allow tools), added 3 scenarios, debug mode
- First eval run: 43% → 89% after fixing tool permissions. 6/7 scenarios pass at 10/10
- Updated vision with full iceberg, cleaned up dead code, committed everything
