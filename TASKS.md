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
- [ ] Publish v0.2.0 to npm (Agent SDK, single-pass fix, all Sprint 5 improvements)
- [ ] Submit plugin to Claude Code marketplace
- [ ] doctor --watch (re-run on .claude/ file changes)
- [ ] Config diff: "score dropped from 85% → 72% in this PR" in GitHub Action output
- [ ] Community scenario format documentation
- [ ] More eval scenarios: git-conventions, session-continuity

### Done

## Upcoming
- **Sprint 7**: Smart init (Claude-driven hooks), MCP server recommendations

## Session Log
### 2026-03-28
- Published to npm (v0.1.0), stress tested 8 stacks, terminal carousel, cleaned global config
### 2026-03-28 (session 2)
- Single-pass --fix (42%→86%), 48 tests, GitHub Action, max-lines check, Agent SDK eval runner
- Code review process added to CLAUDE.md (pre-commit checklist + parallel agents guidance)
- Refactored eval: Agent SDK primary, CLI fallback, decomposed into 5 focused functions
