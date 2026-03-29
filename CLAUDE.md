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
- Three commands: `doctor` (diagnose), `init` (scaffold), `eval` (test configs)
- `init` generates 6 files: CLAUDE.md, TASKS.md, settings.json ($schema + permissions + hooks), .claude/.gitignore, .claudeignore, rules — 91% score out of the box
- `doctor` is pure static analysis — no API calls, no cost, works offline
- `eval` runs Claude headless via Agent SDK against YAML scenarios and scores config quality
- Distributed as npm package (`npx claude-launchpad`) — users never clone this repo
- No third-party plugin dependencies — generates its own hooks and settings

## Commands
- Dev: `pnpm dev`
- Build: `pnpm build`
- Test: `pnpm test` / `pnpm test:run`
- Type check: `pnpm typecheck`
- Run locally: `npx tsx src/cli.ts <command>`

## Project Structure
```
├── src/
│   ├── cli.ts                     # Entry point
│   ├── commands/
│   │   ├── init/                  # Project scaffolder (auto-detects stack)
│   │   │   ├── index.ts           # Command + interactive prompts
│   │   │   └── generators/        # CLAUDE.md, TASKS.md, settings.json generators
│   │   ├── doctor/                # Config diagnostic engine
│   │   │   ├── index.ts           # Command + report renderer
│   │   │   └── analyzers/         # budget, settings, hooks, rules, permissions, mcp
│   │   └── eval/                  # Config testing engine
│   │       ├── index.ts           # Command + result renderer
│   │       ├── schema.ts          # YAML scenario validator
│   │       ├── loader.ts          # Scenario file loader
│   │       └── runner.ts          # Headless Claude execution + check evaluation
│   ├── lib/
│   │   ├── detect.ts              # Project auto-detection (language, framework, tools)
│   │   ├── parser.ts              # Parse .claude/ directory structure
│   │   └── output.ts              # Terminal formatting (colors, tables, score bars)
│   └── types/index.ts             # All type definitions
├── scenarios/common/              # Built-in eval scenarios (YAML)
├── tests/                         # Vitest tests
└── setup.sh                       # Legacy bash scaffolder (to be removed)
```

## Conventions
- Git: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Immutable data patterns — never mutate, always return new objects
- Functions < 50 lines, files < 400 lines
- Named exports only, no `any` types
- All errors handled explicitly with user-friendly messages

## Versioning
- Follow semver: patch (bugfix/refactor), minor (new feature), major (breaking)
- Before pushing, check if changes warrant a version bump:
  - If `src/` changed: bump patch in `package.json`, update CHANGELOG.md
  - If new command/flag added: bump minor
- CHANGELOG.md is the source of truth for what shipped in each version
- Format: `## [x.y.z] — YYYY-MM-DD` with Added/Changed/Fixed/Removed sections

## Pre-Commit Checklist
Before every commit, self-review:
1. Read back every changed file — look for dead code, unused imports, wrong types
2. Run `pnpm typecheck && pnpm test:run` — no commit if either fails
3. Check function lengths (<50 lines) and file lengths (<400 lines)
4. Verify no `any` types, no mutation, no hardcoded values crept in
5. After major features: spawn a code review agent to audit the changes

## Parallel Agents
Always use parallel agents when applicable:
- Research tasks: spawn multiple agents with different lenses (code audit, feature gaps, competitive analysis)
- Stress testing: use one Bash call with a shell loop (agents can't run Bash — see memory)
- Code review: spawn an Explore agent to audit while continuing to build
- Never spawn agents for sequential/dependent work — only for independent parallel tasks

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
