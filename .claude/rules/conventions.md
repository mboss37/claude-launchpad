# Project Conventions

## Code Style
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Immutable data patterns — never mutate, always return new objects
- Functions < 50 lines, files < 400 lines
- Named exports only, no `any` types
- Handle errors explicitly — no empty catch blocks
- Validate input at system boundaries
- Use lookup tables / config objects over switch statements (see `tryFix()`, `detectScripts()`)

## Versioning
- Semver: patch (bugfix/refactor), minor (new feature), major (breaking)
- If `src/` changed: bump patch in `package.json`, update CHANGELOG.md
- If new command/flag added: bump minor
- CHANGELOG format: `## [x.y.z] — YYYY-MM-DD` with Added/Changed/Fixed/Removed

## Pre-Commit Checklist
1. Read back every changed file — dead code, unused imports, wrong types
2. Run `pnpm typecheck && pnpm test:run` — no commit if either fails
3. Check function lengths (<50 lines) and file lengths (<400 lines)
4. Verify no `any` types, no mutation, no hardcoded values
5. After major features: spawn a code review agent to audit

## Parallel Agents
- Research tasks: spawn multiple agents with different lenses
- Stress testing: use one Bash call with a shell loop (agents can't run Bash — see memory)
- Code review: spawn an Explore agent to audit while continuing to build
- Never spawn agents for sequential/dependent work — only for independent parallel tasks
