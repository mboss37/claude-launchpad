# Claude Launchpad — Task Tracker

> Claude: Read this at session start. Keep this file SHORT — only current state matters.
> Rules: (1) Only show current + next sprint tasks. (2) Completed sprints get one summary line. (3) Session log: max 3 lines per session, keep only last 3 sessions. (4) Target: under 80 lines total.

## Completed Sprints
- **Sprint 0**: Bash scaffolder — killed and replaced
- **Sprint 1**: TS CLI — init, doctor (7 analyzers), enhance, eval engine, plugin, landing page, 34 tests
- **Sprint 2**: Eval real — 7 scenarios running, 89% score, sandbox isolation, debug mode
- **Sprint 3**: Actionable — doctor --fix (42%→86%), .claudeignore gen, settings merge, story page
- **Sprint 4**: Ship — npm published (v0.1.0), stress tested 8 stacks (all pass), landing page carousel, self-scores 89%
- **Sprint 5**: Harden — Agent SDK eval runner, single-pass --fix, 48 tests, GitHub Action, max-lines check, code review process

## Current Sprint: Sprint 6 — Community & Polish

### In Progress

### To Do
- [ ] Submit plugin to marketplace (needs human: claude.ai/settings/plugins/submit)
- [ ] Config diff in GitHub Action output (before/after score comparison)
- [ ] Community scenario format documentation (how to write your own YAML scenarios)
- [ ] More test coverage for fixer.ts and runner.ts

### Done
- [x] v0.2.0 published to npm
- [x] doctor --watch (live score on config changes)
- [x] 2 new eval scenarios (git-conventions, no-hardcoded-values) — 9 total
- [x] Complete plugin: 4 skills (/doctor, /init, /enhance, /eval) + PostToolUse hook
- [x] Plugin manifest updated with author, repository, homepage

## Upcoming
- **Sprint 7**: Smart init (Claude-driven hooks), MCP server recommendations

## Session Log
### 2026-03-28
- Published to npm (v0.1.0), stress tested 8 stacks, terminal carousel, cleaned global config
### 2026-03-28 (session 2)
- Single-pass --fix, 48 tests, GitHub Action, Agent SDK eval runner, code review process
### 2026-03-28 (session 3)
- v0.2.0 published. doctor --watch. 9 eval scenarios. Complete plugin (4 skills + hook).
