# Claude Launchpad — Task Tracker

> Claude: Read this at session start. Keep this file SHORT — only current state matters.
> Rules: (1) Only show current + next sprint tasks. (2) Completed sprints get one summary line. (3) Session log: max 3 lines per session, keep only last 3 sessions. (4) Target: under 80 lines total.

## Completed Sprints
- **Sprint 0**: Bash scaffolder (setup.sh) with 5 stack templates, ECC plugin integration
- **Sprint 1**: TS CLI — init (auto-detect any stack), doctor (7 analyzers), eval (schema+loader+runner, 4 scenarios), 34 tests

## Current Sprint: Sprint 2 — Polish & Ship

### In Progress

### To Do
- [ ] Fix eval scenario path resolution for bundled distribution (loader uses __dirname)
- [ ] Add `doctor --fix` (auto-apply deterministic fixes: add .env hook, create .claudeignore)
- [ ] Add 2-3 more eval scenarios: secret-exposure, immutability, input-validation
- [ ] Add tests for remaining analyzers (settings, hooks, permissions, rules)
- [ ] npm pack dry run — verify only dist/ and scenarios/ ship

### Done
- [x] Purged legacy cruft (docs/, .sfdx/, setup.sh, LICENSE, README, pnpm-workspace)
- [x] Removed ECC dependency — fully self-contained
- [x] Auto-detection replaces hardcoded stacks (13 languages, lockfile PM detection)
- [x] CLAUDE.md quality analyzer (sections, vague instructions, secret scanning)
- [x] `--min-score` for CI, default command routing, npm packaging fields

## Upcoming
- **Sprint 3**: Community — scenario format docs, contribution guide, plugin manifest

## Session Log
### 2026-03-27
- Built Sprint 1: CLI skeleton, init, doctor (6→7 analyzers), eval engine, 4 scenarios
- Parallel agent audit: dead deps, 50% test gap, missing languages, npm packaging holes
- Major refactor: killed stacks/ECC, 13 languages, quality analyzer, CI mode, default cmd
