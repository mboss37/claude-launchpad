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
- **Sprint 18**: Algorithm Tuning + Ink Dashboard + Skills — v0.12.1, decay/injection/tagging tuning from 3-expert panel, blessed→Ink migration, skill rewrites (Anthropic patterns), dashboard delete, path-scoped rules in /lp-enhance
- **Sprint 19**: Memory Placement (v0.15.0) — local vs shared config routing, 28 files, 296 tests
- **Sprint 20**: Outcome-First Docs — rewrote all docs/README/landing page for value not features
- **Sprint 21**: Memory Bug Fixes — benchmark suite (54 tests), relation decay + type filter fixes
- **Sprint 22**: Purge + Doctor Modernization (v0.16.0) — TUI purge, SessionEnd/MCP checks, fixer extraction, 322 tests
- **Sprint 23**: Stability (v1.0.0) — sync status/clean, content_hash dedup, immutability fixes, 57 manual tests, 10 bugs fixed, cross-device sync framing

## Current Sprint: Sprint 25 — Doctor Intent Detection (v1.5.0)

Fixes false-positive section flags on mature CLAUDE.md files. Discovered on swissazan: `doctor` flags "Missing ## Session Start" even though `## Sprint Planning` covers the intent. Replaces regex-exact heading matching with keyword-based intent rules. Non-breaking.

### Formal LP-STUB Markers
- [ ] Update `addClaudeMdSection` to wrap AI-recommended stubs in `<!-- LP-STUB: ai-recommended -->` ... `<!-- /LP-STUB -->`
- [ ] Update FIX_TABLE entries for Session Start, Backlog, Stop-and-Swarm, Architecture to use marker format

### Intent Analyzer
- [ ] Create `src/commands/doctor/analyzers/quality-intents.ts` with `INTENT_RULES` for 7 sections
- [ ] `parseSections(content)` helper — split on `^## ` markers, detect LP-STUB marker
- [ ] Replace `BASE_SECTIONS` regex loop in `analyzers/quality.ts`
- [ ] Preserve issue message wording (`Missing "## X" section`) so FIX_TABLE substring match still works

### Tests
- [ ] Synthesize `tests/fixtures/mature-project.md` — `## Sprint Planning` body satisfies Session Start intent, no stubs
- [ ] Synthesize `tests/fixtures/new-project.md` — LP-STUB-marked sections, must flag as unsatisfied
- [ ] New `tests/quality-intents.test.ts` — ~8 assertions covering satisfied / missing / stub-not-satisfied cases

### Ship
- [ ] All tests green
- [ ] CHANGELOG v1.5.0 with marker format callout (users will see new markers after `--fix`)
- [ ] Publish v1.5.0

## Session Log
### 2026-04-16 (session 37)
- Fixed two-machine sync resurrection bug: tombstones now ride in sync payload v2, phased merge (tombstones → memories → relations), delete wins on timestamp tie.
- Migration 004 adds `memory_tombstones` table; hardDelete/deleteByType/deleteByProject write tombstones atomically. Doctor detects + upgrades stale backgrounded SessionEnd hooks (`& exit 0` → `; exit 0`).
- Verified end-to-end with a real-gist round-trip (5 scenarios, isolated DBs). Docs synced (changelog 4 releases behind caught up). Published v1.4.0.

### 2026-04-15 (session 36)
- Fixed silently broken SessionStart auto-pull (`-y` flag), TUI content jump on big memories, viewport off-by-one past entry 35.
- Added Enter-to-expand memory overlay with scroll, `pull --all` skips projects not set up locally, per-project pull output clarity.
- Softened content-validation (no hard-reject on length), locked TUI three-panel layout to strict height. Published v1.3.0.

### 2026-04-13 (session 35)
- Doctor now checks for skill authoring conventions in rules files, fixer adds section (v1.2.0).
- Updated skill authoring to match official Claude Code docs (500-line limit, 250-char desc, $ARGUMENTS, disable-model-invocation).
- Renamed "When Stuck" to "Stop-and-Swarm" across all surfaces, restored local config steps in /lp-enhance (v1.2.1).
