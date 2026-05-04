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
- Update TASKS.md as you complete work. Between sprints, `## Current Sprint` must be empty

## Backlog
- See `.claude/rules/workflow.md` for the BACKLOG/TASKS lifecycle (path-scoped; auto-loads on edit)
- Every WP uses the 7-field template (Priority, Proposed, Stories/Docs, Depends on, Estimate, Trigger to pull, Definition of done)
- WPs are **moved** between BACKLOG.md and TASKS.md, not copied — a WP lives in exactly one file at a time
- BACKLOG.md keeps structural sections (P0/P1/P2/P3/Changelog); do not delete the sections, keep them active

## Architecture
- Four CLI commands: `init` (scaffold), `doctor` (diagnose), `eval` (test configs), `memory` (optional persistent memory)
- Two skills: `/lp-enhance` (AI-powered CLAUDE.md improver, currently v9), `/lp-migrate-memory` (legacy memory migration)
- `doctor` is pure static analysis — no API calls, no cost, works offline; `--fix` auto-repairs issues
- `init` generates 9 files: CLAUDE.md, TASKS.md, BACKLOG.md, settings.json, .gitignore, .claudeignore, conventions.md, workflow.md, lp-enhance skill; plus three hook scripts (sprint-size, sprint-open, workflow-check)
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
- **Unit tests** (`pnpm test:run`): Vitest, 447 tests covering generators, analyzers, fixers, repos, services, utils
- **Regression tests** (`pnpm test:regression`): bash script that runs the real CLI against temp projects (doctor, --fix, JSON output, idempotency)
- **Benchmarks** (`pnpm bench:memory`): 57 tests measuring memory retrieval, injection, decay, and scale

Unit tests for logic, regression tests for CLI end-to-end, benchmarks for memory algorithm quality.

## Memory Benchmarks
Benchmark suite in `tests/memory/benchmarks/` — 57 tests across 4 files measuring retrieval quality, injection quality, decay accuracy, and scale performance. Excluded from `pnpm test`; run separately via `pnpm bench:memory`.

**MANDATORY**: Before releasing any memory feature, bugfix, or algorithm change, run `pnpm bench:memory` and verify no regressions. Do NOT ship memory changes with failing benchmarks. If a change intentionally shifts metrics (e.g. tuning scoring weights), update the benchmark thresholds and document why in the commit message.

## Development Workflow (Superpowers-first)

This project uses the superpowers skills for every non-trivial change. The sequence is not optional:

1. **Brainstorm** — before any creative/design work, invoke `superpowers:brainstorming`. Clarify intent, requirements, tradeoffs BEFORE touching code.
2. **Plan** — for multi-step work, invoke `superpowers:writing-plans`. The plan file is the source of truth during execution; revise it, don't abandon it.
3. **TDD** — for any new feature, bug fix, or algorithm change, invoke `superpowers:test-driven-development`. Write the failing test FIRST, make it pass, refactor. Never write implementation before the test. See "Test-Driven Development" in `.claude/rules/conventions.md` for when this is rigid vs flexible.
4. **Execute** — drive implementation from the plan. Use `superpowers:subagent-driven-development` when tasks are independent; use `superpowers:dispatching-parallel-agents` only for genuinely independent research/lookups.
5. **Debug** — when encountering a bug or unexpected behavior, invoke `superpowers:systematic-debugging` BEFORE guessing a fix.
6. **Verify** — before claiming "done", invoke `superpowers:verification-before-completion`. Run the verification commands; confirm the output; don't assert success without evidence.
7. **Review** — before sprint-ending commit, invoke `superpowers:requesting-code-review` (MANDATORY, see Sprint Reviews). Address Important findings in-sprint.
8. **Integrate** — when work is complete, invoke `superpowers:finishing-a-development-branch` to decide merge/PR/cleanup.

Shortcut rule: if a skill's description plausibly applies, **invoke it**. Rationalizing "this is too simple" is the failure mode.

## Sprint Lifecycle

**Starting a sprint** (one session, one commit):
1. Pick top-priority WPs from `BACKLOG.md` (P0 first, then P1).
2. Same edit: delete from BACKLOG.md, add to `TASKS.md ## Current Sprint` as `- [ ] WP-NNN — short title`.
3. Update `BACKLOG.md ## Changelog`: `YYYY-MM-DD: WP-NNN pulled into Sprint N`.
4. Invoke `superpowers:writing-plans` if the sprint is non-trivial (>1 WP or any new feature).
5. For hard-TDD surfaces (see conventions.md), invoke `superpowers:test-driven-development` BEFORE implementation.
6. Commit the pull + plan together: `chore(sprint-N): pull WP-NNN into sprint + plan`.

**Closing a sprint** (one session, one commit):
1. All `## Current Sprint` items checked off, or explicitly moved back with rationale.
2. Invoke `superpowers:requesting-code-review` — address Important findings before commit.
3. Add one-line summary to `## Completed Sprints`.
4. Empty `## Current Sprint` back to its placeholder comment.
5. Update `## Session Log` (prune to 3 entries).
6. `BACKLOG.md ## Changelog`: `YYYY-MM-DD: Sprint N closed. WP-NNN done.`
7. Commit with feat/fix/refactor prefix; bump version + CHANGELOG per release checklist if shipping.

## Sprint Reviews (MANDATORY before sprint-ending commit)

Every sprint-ending commit goes through `superpowers:requesting-code-review`:
1. Invoke the skill; dispatch the `superpowers:code-reviewer` subagent with base/head SHAs and a description.
2. Fix all **Critical** and **Important** findings before committing.
3. Minor findings can be deferred to BACKLOG.md as WPs.
4. Skip ONLY for trivial sprints (docs-only, config-only, no logic).

This replaces the older "spawn an Explore agent" pattern. Both produce code review; the superpowers reviewer has more structure (Strengths / Critical / Important / Minor / Assessment).

## Conventions
- Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Immutable data patterns — never mutate, always return new objects
- Functions < 50 lines, files < 400 lines
- Named exports only, no `any` types
- All errors handled explicitly with user-friendly messages
- Lookup tables over switch statements (see `tryFix()`, `detectScripts()`)
- Semver: patch (bugfix), minor (new command/flag), major (breaking)
- See `.claude/rules/conventions.md` for pre-commit checklist, TDD rules, parallel agent rules

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
- Never write implementation before the test when the change qualifies for TDD (see conventions.md)

## Stop-and-Swarm
Three failed iterations on the same problem = stop iterating alone.
On the fourth attempt, spin up at least 3 parallel agents via the Agent tool, each investigating from a different angle:
1. Root-cause debug agent
2. Upstream library/docs research agent
3. Alternative architecture agent
Wait for all agents to return, synthesize their findings, then act.
Don't keep guessing in circles — rotate perspectives.

Before spinning up agents, consider `superpowers:systematic-debugging` — it often resolves the loop without needing the swarm.

## Key Decisions
- Stack-agnostic: auto-detects project type instead of offering a fixed menu
- No ECC dependency: generates its own hooks and settings
- npm distribution: `npx claude-launchpad` — not a template repo to clone
- Doctor is the gateway (free, immediate), eval is the differentiator (costs money, measures quality)
- YAML for eval scenarios: human-readable, community-contributable
- Memory is optional: native deps deferred to user install, pure-JS deps in optionalDependencies
- Plugin system killed: CLI is the product, no marketplace dependency
- Workflow discipline is load-bearing (v1.10.0): BACKLOG/TASKS template + `.claude/rules/workflow.md` + workflow-check hook shipped together

## Memory (agentic-memory)
This project uses **agentic-memory** for persistent memory across sessions.
- **DO NOT** use the built-in auto-memory system (~/.claude/projects/*/memory/)
- Memory context is **automatically injected** at session start via SessionStart hook
- Use `memory_search` before `memory_store` to check for duplicates
- Use `memory_update` to modify existing memories instead of creating new ones
- **STORE IMMEDIATELY** when: a dependency strategy changes, an architecture decision is made, a convention is established, a bug pattern is discovered, or a feature is killed/added
- **NEVER** store credentials, API keys, tokens, passwords, or other secrets in memories
- Use absolute dates (not "next week") so memories stay useful across sessions
