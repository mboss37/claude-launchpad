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

### Memory Feature
- [x] Finalize standalone memory tool (SQLite + MCP + decay model + web UI)
- [x] Architecture review: integrate into launchpad as optional `memory` command
- [x] Integrate agentic-memory into launchpad (lazy-loaded, optional subcommand)
- [x] Add `memory` to doctor checks (detect if installed, report health)
- [x] TUI dashboard (blessed) for `--dashboard` flag
- [x] Update docs site with memory command documentation
- [x] Landing page design polish (hero height alignment, card grid consistency)
- [x] Review all docs pages for consistency (cross-check CLI vs skill references)
- [x] Publish v0.7.0-dev to npm, test MCP server via npx
- [x] Re-register MCP server with npx path after publish
- [x] Final QA pass: test full flow on clean project (init -> doctor -> memory -> /lp-enhance)
- [x] Upgrade zod 3 to zod 4 (fixes claude-agent-sdk peer dep warning)
- [x] Defer better-sqlite3 compilation to `memory install` (avoid slow install for non-memory users)
- [ ] Memory cleanup UX: dashboard delete keybinding (`d` + confirm), bulk purge by project (`memory --purge <project>`), and prune command for dead/stale memories

## Upcoming
- **Sprint 15**: User testimonials, path-scoped rule generation, community scenario packs

## Session Log
### 2026-03-30 (session 13)
- Sprint review hook (PostToolUse + CLAUDE.md section), v0.6.0 published.
- Landing page: "Run once"/"Run anytime" labels, removed redundant command repetition.
- Docs: "When to re-run" sections, changelog page + header nav link, cleaned CHANGELOG.
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
