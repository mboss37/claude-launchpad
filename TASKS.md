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
- **Sprint 13**: Growth — Fumadocs migration (7 MDX pages, search, OG meta, GitHub Actions deploy), 4-persona docs review, landing page redesign
- **Sprint 14**: Memory — v0.7.5, /lp-enhance skill, agentic-memory integrated (262 tests), TUI dashboard, brain-inspired decay, zero-dep install, plugin removed
- **Sprint 15**: Smart Injection — InjectionService (6-signal scoring, 3 tiers, token-budget packing), fixed injection tracking bugs, 274 tests, docs updated
- **Sprint 16**: Backlog System — v0.10.0, BACKLOG.md in init/doctor/fix, three-file system, budget 200, MCP registration fix, content review skill, 280 tests
- **Sprint 17**: Memory Sync — v0.11.0, push/pull via private GitHub Gist, multi-file per project, auto-discovery, dedup guard, 294 tests

## Current: Sprint 18 — Memory Algorithm Tuning

Expert panel review (cognitive scientist, retrieval engineer, prompt engineer). All findings.

**Decay & Lifecycle:**
- [ ] Adjust half-lives (episodic 60→30d, semantic 365→540d)
- [ ] Logarithmic access modifier (replace step function)
- [ ] Stronger relation modifier (0.5x for 3+, 0.35x for 6+)
- [ ] Fix dashboard lifespan to use createdAt (match decay-service)

**Tagging & Discovery:**
- [ ] Add FTS5 porter tokenizer (migration)
- [ ] Normalize tags at store time (lowercase, singularize)
- [ ] Tag alias map (bugfix→bug, etc.)
- [ ] Auto-tagging from content keywords
- [ ] Synonym expansion in search queries

**Injection & Scoring:**
- [ ] Raise token budget 2000→3000
- [ ] Redistribute context weight when gitContext missing
- [ ] Smooth cold start ramp (lerp min_score for 6-20 memories)
- [ ] Type diversity cap (max 2 same type in full tier)
- [ ] Branch-name heuristic (fix/* boosts patterns, feat/* boosts procedural)

**Advanced:**
- [ ] Pinned/evergreen slots (importance >= 0.8 gets reserved 10% budget)
- [ ] Staleness detection (contradiction check on store)
- [ ] Summary tier fix (300-400 chars or kill it)

## Session Log
### 2026-04-04 (session 20)
- Sprint 16: BACKLOG.md as first-class artifact (init, doctor, fix, docs, 18 new tests).
- Budget thresholds raised to 150/200/250 (official guidance). Content review skill created globally.
- Published v0.10.0. Dev/release workflow validated with 3 dev publishes before release.
### 2026-04-05 (session 21)
- Sprint 17: Memory sync via private GitHub Gist (push/pull, multi-file per project, auto-discovery).
- Fixed dedup bug (parallel MCP calls), refactored fixer.ts + runner.ts, 294 tests.
- Published v0.11.0. Tested cross-device sync between Mac Mini and MacBook.
