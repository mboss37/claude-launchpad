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
- **Sprint 7**: Smarts — v0.3.0, watcher, .claudeignore in --fix, enhance budget cap, Tech Stack, 57 tests
- **Sprint 8**: Polish — v0.3.4, security fix, 5 persona reviews, Tailwind redesign, glossary, suite filtering, eval reports, 58 tests
- **Sprint 9**: Scale — v0.4.0, enhanced init (6 files, $schema, permissions.deny, destructive cmd blocking, rules), Tailwind docs page, marketplace submissions, Reddit posts

- **Sprint 10**: Refine — v0.4.1-v0.4.3, memory management, PostCompact hook, eval sandbox fix, CHANGELOG, 71 tests
- **Sprint 11**: Security — v0.5.0, credential deny rules, sandbox, bypass disable, 5 new doctor checks, interactive eval, 91 tests

- **Sprint 12**: Smart Defaults — v0.5.1, 4 new settings checks, SessionStart hook, enhance suggestions, 2 workflow scenarios, --fix re-scan, 99 tests

## Upcoming
- **Sprint 13**: Path-scoped rule generation in init, community scenario packs, paid tier exploration
- Plugin marketplace go-live (waiting on Anthropic review)

## Session Log
### 2026-03-29 (session 8)
- v0.4.1-v0.4.3: memory, PostCompact, eval sandbox fix, CHANGELOG, 71 tests.
- Claude Code source research → FINDINGS.md.
### 2026-03-29 (session 9)
- v0.5.0: security hardening — credential deny, sandbox, bypass disable, 5 doctor checks.
- Interactive eval mode. 2 new scenarios (13 total). buildGradle bug fix. 91 tests.
- Code review (Opus): addressed M1, M3, L2. README + docs + landing page updated.
