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

- **Sprint 12**: Smart Defaults — v0.5.1, 4 settings checks, SessionStart hook, --fix re-scan, 99 tests
- **Sprint 13**: Growth — Fumadocs migration (7 MDX pages, search, OG meta, GitHub Actions deploy), 4-persona docs review, landing page redesign, component-rich docs (Steps, Tabs, Files, Accordions, Cards)

- **Sprint 14**: Memory — v0.7.5, /lp-enhance skill, agentic-memory integrated (262 tests), TUI dashboard, brain-inspired decay, zero-dep install, plugin removed, landing page redesign

## Upcoming: Sprint 15 — Smart Injection + Polish

### Smart Memory Injection (priority)
- [x] Phase 0: Fix incrementInjection bug (never called, injection count permanently 0)
- [x] Phase 0: Fix incrementAccess called during injection (should only be on explicit search)
- [x] Phase 1: Create injection-service.ts (unified scoring, token-budget packing)
- [x] Phase 2: Rewrite context.ts to use InjectionService (replace loadSessionContext + binary mode)
- [x] Phase 3: Add config constants (INJECTION_WEIGHTS, TYPE_MULTIPLIERS, RECENCY_HALF_LIFE)
- [x] Phase 3: Three presentation tiers (full/summary/index) replace binary full/graph
- [x] Phase 3: 12 tests for scoring, token allocation, tier assignment
- [ ] Phase 4: MMR diversity selection (avoid injecting 5 memories on same topic)
- [ ] Phase 4: Exploration slots (1/8 reserved for discovery)
- [ ] Clean up duplicate memories in DB from migration

### Memory UX
- [ ] Dashboard delete keybinding (`d` + confirm)
- [ ] Bulk purge by project (`memory --purge <project>`)

### Launch Campaign
- [ ] Landing page: before/after diff view (CLAUDE.md + settings.json)
- [ ] Record 10-sec terminal GIF (bad score → --fix → good score)
- [ ] PRs to awesome-claude-code lists
- [ ] Show HN post + Product Hunt launch

## Session Log
### 2026-04-01 (session 14)
- Replaced enhance CLI with /lp-enhance skill (init scope picker, doctor detection).
- Integrated agentic-memory as optional `memory` command (265 tests, lazy-loaded native deps).
- Simplified memory UX: smart default (install prompt or stats), --dashboard, hidden plumbing.
### 2026-04-02 (session 15)
- Updated landing + docs sequence so core flow is `init -> doctor -> /lp-enhance -> eval`, with memory clearly optional.
- Aligned docs + README with built command model and conditional behavior (`/lp-enhance` install conditions, memory skill injection, eval/doctor flag accuracy).
- Fixed eval UX mismatches: interactive suite labels now match shipped scenarios, and any non-default eval flag now skips interactive prompts.
### 2026-04-02 (session 16)
- Ran UX/UI + content specialist audits for landing page clarity, spacing density, and CTA hierarchy.
- Redesigned homepage flow to emphasize 4 core commands and moved memory into a distinct optional add-on block.
- Improved CTA path (install + quickstart), tightened section spacing, and simplified copy for first-time comprehension.
### 2026-04-03 (session 17)
- Upgraded zod 3 to 4, deferred native deps to memory install, removed all optional deps bloat.
- Removed plugin system entirely. Published v0.7.5 (3s install, zero warnings).
- Migrated legacy memories, cleaned duplicates, fixed cwdRequire for global install.
