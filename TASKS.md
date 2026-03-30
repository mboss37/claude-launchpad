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

## Current Sprint: Sprint 14 — Launch Campaign

### Features
- [x] Sprint review hook — PostToolUse hook detects sprint completion in TASKS.md, nudges code review
- [x] Sprint review CLAUDE.md section — quality check protocol for sprint boundaries
- [x] Sprint review validation — manual testing on secondary project

### Week 1 — Foundation
- [x] Submit to DevHunt (paid launch week)
- [x] Logo created (rocket + terminal brackets)
- [x] Screenshots prepared (6 screenshots: doctor, --fix, diff, enhance)
- [ ] Landing page: before/after diff view (CLAUDE.md + settings.json)
- [ ] Record 10-sec terminal GIF (bad score → --fix → good score)
- [ ] Add OG image to docs (1200x630, terminal screenshot or GIF frame)
- [ ] PRs to awesome-claude-code lists (hesreallyhim, rohitg00, travisvn)
- [ ] Post in Anthropic Discord #tools channel
- [ ] Update npm keywords (claude, claude-code, ai, cli, developer-tools)

### Week 2 — Content
- [ ] Write dev.to article: "Why your CLAUDE.md is probably wrong"
- [ ] Cross-post to Hashnode
- [ ] Submit to TLDR newsletter (tldr.tech)

### Week 3 — Big Bang (all on same Tuesday)
- [ ] Show HN post (Tue 8-10am EST)
- [ ] Product Hunt launch (prep assets in advance)
- [ ] X/Twitter thread with GIF + tag @AnthropicAI
- [ ] r/ClaudeCode post (home base)
- [ ] r/SideProject post

### Week 4 — Expand
- [ ] r/ClaudeAI, r/vibecoding, r/commandline, r/opensource, r/coolgithubprojects
- [ ] Plugin marketplace go-live (waiting on Anthropic review)

### Memory Feature
- [ ] Finalize standalone memory tool (SQLite + MCP + decay model + web UI)
- [ ] Architecture review: integrate into launchpad or ship as extension

## Upcoming
- **Sprint 15**: User testimonials, path-scoped rule generation, community scenario packs

## Session Log
### 2026-03-29 (session 10)
- Fumadocs migration: 7 MDX pages, GitHub Actions auto-deploy, search, OG meta.
- Landing page: provocative hero, 2x2 command cards with icons, footer.
- Docs: Steps, Tabs, File trees, Accordions, Callouts, navigation Cards.
### 2026-03-29 (session 11)
- Landing page polish: aligned homepage shell with header width, upgraded hero/cards/CTA, added shadcn-style UI primitives for the docs app.
### 2026-03-29 (session 12)
- Homepage redesign: more editorial hero, asymmetric command layout, stronger proof board, improved light/dark presentation.
### 2026-03-30 (session 13)
- Sprint review hook (PostToolUse + CLAUDE.md section), v0.6.0 published.
- Landing page: "Run once"/"Run anytime" labels, removed redundant command repetition.
- Docs: "When to re-run" sections, changelog page + header nav link, cleaned CHANGELOG.
