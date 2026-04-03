# Claude Launchpad

CLI toolkit that makes Claude Code setups measurably good — diagnose, scaffold, evaluate.

## Stack
- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 22+
- **CLI**: Commander.js + @inquirer/prompts
- **Testing**: Vitest
- **Package Manager**: pnpm
- **Build**: tsup (single-file CLI bundle)

## Session Start
- ALWAYS read @TASKS.md first — it tracks progress across sessions
- Update TASKS.md as you complete work

## Architecture
- Three CLI commands: `doctor` (diagnose), `init` (scaffold), `eval` (test configs)
- `/lp-enhance` skill: AI-powered CLAUDE.md improver, runs inside Claude Code session (installed by init)
- `doctor` is pure static analysis — no API calls, no cost, works offline; `--fix` auto-repairs issues
- `init` generates 7 files (CLAUDE.md, TASKS.md, settings.json, .gitignore, .claudeignore, rules, lp-enhance skill)
- `eval` runs Claude via Agent SDK against YAML scenarios and scores config quality
- Distributed as npm package (`npx claude-launchpad`) — users never clone this repo
- See `.claude/rules/architecture.md` for full project structure and command flow

## Commands
- Dev: `pnpm dev`
- Build: `pnpm build`
- Test: `pnpm test` / `pnpm test:run`
- Type check: `pnpm typecheck`
- Run locally: `npx tsx src/cli.ts <command>`

## Sprint Reviews
When all tasks in the current sprint are complete, do a quick quality check before committing:
- Scan changed files for dead code, debug logs, and TODO hacks
- Run tests and type-checker if available
- Check for convention violations and hardcoded values
- Fix any issues, then commit
- Skip if the sprint was trivial (docs, config-only changes)

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
Before every commit, ask: does this change affect the published npm package?
If yes (any change to src/, package.json deps, tsup.config.ts):
1. Bump version in package.json AND src/cli.ts
2. Update CHANGELOG.md and docs/content/docs/changelog.mdx
3. Commit, push, then prompt user to publish (`pnpm build && npm publish`)
4. After publish: create GitHub release (`gh release create v<version>`)
If no (docs-only, landing page, TASKS.md): commit normally, no version bump

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

## Memory & Learnings
- Save gotchas, non-obvious decisions, and deferred issues to project memory
- Save user preferences and workflow patterns to global memory
- Before creating a new memory, check MEMORY.md for existing entries to update
- Use absolute dates (not "next week") so memories stay useful across sessions
- Don't save things derivable from code, git history, or this file

## Memory (agentic-memory)
This project uses **agentic-memory** for persistent memory across sessions.
- **DO NOT** use the built-in auto-memory system (~/.claude/projects/*/memory/)
- Memory context is **automatically injected** at session start via SessionStart hook - no need to call memory_recent manually
- Use `memory_search` to find specific memories by keyword
- Use `memory_store` to save decisions, gotchas, and learnings worth remembering
- Use `memory_stats` to check memory health
