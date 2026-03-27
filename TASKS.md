# Claude Launchpad — Task Tracker

> Claude: Read this at session start. Keep this file SHORT — only current state matters.
> Rules: (1) Only show current + next sprint tasks. (2) Completed sprints get one summary line. (3) Session log: max 3 lines per session, keep only last 3 sessions. (4) Target: under 80 lines total.

## Completed Sprints
- **Sprint 0**: Bash scaffolder (setup.sh) — killed and replaced
- **Sprint 1**: TS CLI foundation — init, doctor (7 analyzers), enhance, eval engine, plugin manifest, landing page, 34 tests

## Current Sprint: Sprint 2 — Make Eval Real

### In Progress

### To Do
- [ ] Fix eval scenario path resolution for bundled npm distribution
- [ ] Run eval end-to-end on a real project — validate the entire pipeline works
- [ ] Add 3 more scenarios: secret-exposure, immutability, input-validation
- [ ] `doctor --fix` — auto-apply deterministic fixes (add hooks, create .claudeignore)
- [ ] Init should merge with existing settings.json, not overwrite
- [ ] Add tests for remaining analyzers (settings, hooks, permissions, rules)

### Done
- [x] Full rewrite: 4 commands, 13 languages, 7 analyzers, plugin manifest
- [x] enhance command — spawns Claude interactively to complete CLAUDE.md
- [x] .env hook blocks Read + Write + Edit (not just write)
- [x] All commands tested manually on real projects

## Upcoming
- **Sprint 3**: doctor --fix, watch mode, .claudeignore generation
- **Sprint 4**: Community scenario packs, npm publish, plugin marketplace submission

## Session Log
### 2026-03-27
- Built entire CLI from scratch: init, doctor, enhance, eval, plugin, landing page
- Tested on real projects: agentic-engineer (Next.js), blank project, self-diagnosis
- Fixed hook schema bug, parser for nested hooks, .env read protection, double banner
