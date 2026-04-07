# Claude Launchpad

CLI toolkit that makes Claude Code setups measurably good — diagnose, scaffold, evaluate, remember.

## Stack
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 22+
- **CLI**: Commander.js + @inquirer/prompts
- **Testing**: Vitest
- **Package Manager**: pnpm
- **Build**: tsup (two entry points: cli.ts + memory/server.ts)

## Session Start
- ALWAYS read @TASKS.md first — it tracks progress across sessions
- Update TASKS.md as you complete work

## Backlog
- When a feature is discussed but deferred, add it to `BACKLOG.md` immediately
- Never leave future ideas only in TASKS.md or conversation — they get lost
- BACKLOG.md is the single source of truth for parked features

## Architecture
- Four CLI commands: `init` (scaffold), `doctor` (diagnose), `eval` (test configs), `memory` (optional persistent memory)
- Two skills: `/lp-enhance` (AI-powered CLAUDE.md improver), `/lp-migrate-memory` (legacy memory migration)
- `doctor` is pure static analysis — no API calls, no cost, works offline; `--fix` auto-repairs issues
- `init` generates 8 files (CLAUDE.md, TASKS.md, BACKLOG.md, settings.json, .gitignore, .claudeignore, rules, lp-enhance skill)
- `eval` runs Claude via Agent SDK (falls back to Claude CLI if SDK not installed)
- `memory` is optional — SQLite + FTS5 + decay model + 7 MCP tools + TUI dashboard
- Memory native deps (better-sqlite3, sqlite-vec) are NOT bundled — user installs when setting up memory
- Memory pure-JS deps (zod, @modelcontextprotocol/sdk) are optionalDependencies — always installed
- Distributed as npm package (`npx claude-launchpad`) — users never clone this repo
- See `.claude/rules/architecture.md` for full project structure and command flow

## Commands
- Dev: `pnpm dev`
- Build: `pnpm build`
- Test: `pnpm test` / `pnpm test:run`
- Benchmarks: `pnpm bench:memory`
- Type check: `pnpm typecheck`
- Run locally: `npx tsx src/cli.ts <command>`

## Test Layers
- **Unit tests** (`pnpm test:run`): Vitest, 318 tests covering analyzers, repos, services, utils, data sources
- **Regression tests** (`pnpm test:regression`): bash script that runs the real CLI against temp projects (doctor, --fix, JSON output, idempotency)
- **Benchmarks** (`pnpm bench:memory`): 54 tests measuring memory retrieval, injection, decay, and scale

Unit tests for logic, regression tests for CLI end-to-end, benchmarks for memory algorithm quality.

## Memory Benchmarks
Benchmark suite in `tests/memory/benchmarks/` — 54 tests across 4 files measuring retrieval quality, injection quality, decay accuracy, and scale performance. Excluded from `pnpm test`; run separately via `pnpm bench:memory`.

**MANDATORY**: Before releasing any memory feature, bugfix, or algorithm change, run `pnpm bench:memory` and verify no regressions. Do NOT ship memory changes with failing benchmarks. If a change intentionally shifts metrics (e.g. tuning scoring weights), update the benchmark thresholds and document why in the commit message.

## Sprint Reviews
See `.claude/rules/conventions.md` — sprint review with code review agent is MANDATORY before committing sprint-completing changes.

## Conventions
- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Immutable data patterns — never mutate, always return new objects
- Functions < 50 lines, files < 400 lines
- Named exports only, no `any` types
- All errors handled explicitly with user-friendly messages
- Lookup tables over switch statements (see `tryFix()`, `detectScripts()`)
- Semver: patch (bugfix), minor (new command/flag), major (breaking)
- See `.claude/rules/conventions.md` for pre-commit checklist, versioning details, parallel agent rules

## Release Checklist
**NEVER bump version on every commit.** Use the dev/release publish workflow:
- **During dev**: commit freely, no version bump. When ready to test: `pnpm publish:dev` (publishes under `dev` tag, not `latest`)
- **For release**: bump version in package.json + src/cli.ts, update CHANGELOG.md, commit, push, `pnpm publish:release`, then `git tag v<version> && git push origin v<version> && gh release create v<version>`
- **Non-src changes** (docs, TASKS.md): commit normally, no publish
- See `.claude/rules/conventions.md` for full details

## Off-Limits
- Never hardcode secrets
- Never add third-party dependencies without justification — self-contained
- Never require API keys for `doctor` — it must be free and offline
- Never hardcode stack-specific logic — auto-detect or stay generic
- Never add dependencies without justification — CLI must stay fast (<2s startup)

## Key Decisions
- Stack-agnostic: auto-detects project type instead of offering a fixed menu
- No ECC dependency: generates its own hooks and settings
- npm distribution: `npx claude-launchpad` — not a template repo to clone
- Doctor is the gateway (free, immediate), eval is the differentiator (costs money, measures quality)
- YAML for eval scenarios: human-readable, community-contributable
- Memory is optional: native deps deferred to user install, pure-JS deps in optionalDependencies
- Plugin system killed: CLI is the product, no marketplace dependency

## Memory (agentic-memory)
This project uses **agentic-memory** for persistent memory across sessions.
- **DO NOT** use the built-in auto-memory system (~/.claude/projects/*/memory/)
- Memory context is **automatically injected** at session start via SessionStart hook
- Use `memory_search` before `memory_store` to check for duplicates
- Use `memory_update` to modify existing memories instead of creating new ones
- **STORE IMMEDIATELY** when: a dependency strategy changes, an architecture decision is made, a convention is established, a bug pattern is discovered, or a feature is killed/added
- **NEVER** store credentials, API keys, tokens, passwords, or other secrets in memories
- Use absolute dates (not "next week") so memories stay useful across sessions
