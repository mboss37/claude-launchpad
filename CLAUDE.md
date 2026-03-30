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
- Four commands: `doctor` (diagnose), `init` (scaffold), `enhance` (AI-improve CLAUDE.md), `eval` (test configs)
- `doctor` is pure static analysis — no API calls, no cost, works offline; `--fix` auto-repairs issues
- `init` generates 6 files (CLAUDE.md, TASKS.md, settings.json, .gitignore, .claudeignore, rules) — 91% score out of the box
- `enhance` spawns Claude headless to rewrite CLAUDE.md based on codebase analysis
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

## Off-Limits
- Never hardcode secrets
- Never add third-party plugin dependencies (ECC, etc.) — self-contained
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
