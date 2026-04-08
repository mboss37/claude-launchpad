# Project Conventions

## Git (Trunk-Based)
- All commits go directly to master — no feature branches for solo dev
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Tag releases with `git tag v<version>` after publishing to npm
- If contributors join: revisit and add feature branch + PR requirement

## Code Style
- Immutable data patterns — never mutate, always return new objects
- Functions < 50 lines, files < 400 lines
- Named exports only, no `any` types
- Handle errors explicitly — no empty catch blocks
- Validate input at system boundaries
- Use lookup tables / config objects over switch statements (see `tryFix()`, `detectScripts()`)

## Versioning & Publishing
- Semver: patch (bugfix/refactor), minor (new feature), major (breaking)
- **NEVER bump version on every commit.** Accumulate changes under a dev prerelease tag.
- **Dev publish** (during development):
  1. Do NOT bump version in package.json or cli.ts — the script handles it
  2. Run `pnpm publish:dev` — auto-bumps to `x.y.z-dev.N`, publishes under `dev` tag (not `latest`)
  3. Commit the version bump: `git add package.json src/cli.ts && git commit -m "chore: dev publish"`
  4. No changelog, no GitHub release, no git tag
- **Release publish** (when enough changes accumulate):
  1. Bump version in package.json AND src/cli.ts to the next clean semver (e.g. `0.8.0`)
  2. Update CHANGELOG.md (format: `## [x.y.z] — YYYY-MM-DD` with Added/Changed/Fixed/Removed)
  3. Commit, push, then `pnpm publish:release`
  4. Create git tag + GitHub release: `git tag v<version> && git push origin v<version> && gh release create v<version>`
- Docs-only / non-src changes: commit normally, no version bump, no publish

## Pre-Commit Checklist
1. Run `pnpm typecheck && pnpm test:run` — NEVER commit if either fails
2. If changes touch `src/commands/memory/` — run `pnpm bench:memory` and verify no regressions
3. Check function lengths (<50 lines) and file lengths (<400 lines)
4. Verify no `any` types, no mutation, no hardcoded values

## Sprint Review (MANDATORY before committing sprint-completing changes)
When all sprint tasks are done, you MUST spawn a code review agent BEFORE committing:
1. Spawn an Explore agent to audit all changed files for: dead code, unused imports, logic bugs, convention violations, hardcoded values, function/file length violations
2. Wait for the review to complete
3. Fix all HIGH and MEDIUM severity issues
4. Only then commit
5. Skip ONLY if the sprint was trivial (docs-only, config-only changes with no logic)

## Skill Authoring
When creating Claude Code skills (.claude/skills/*/SKILL.md):
- Add TRIGGER when / DO NOT TRIGGER when clauses in the description for auto-invocation
- Add allowed-tools in frontmatter to restrict tool access (e.g. Read, Glob, Grep for read-only skills)
- Add argument-hint in frontmatter showing the expected input format
- Structure as phases: Research, Plan, Execute, Verify with "Done when:" success criteria per phase
- Handle edge cases and preconditions before execution

## Backlog Hygiene
After every feature merge or sprint completion:
1. Scan BACKLOG.md for items that are now done, partially done, or no longer relevant
2. Delete completed/killed items entirely — no strikethrough, no tombstones, they're just noise
3. Update partially-done items to reflect remaining work only
4. Re-prioritize if the feature changed what matters next
5. BACKLOG.md should never exceed 50 lines of active items

## Content Updates
When any feature, fix, or behavioral change ships, evaluate all three surfaces:
- **Landing page** (`docs/app/(home)/page.tsx`): high-level hooks — what it does, why it matters. No implementation details.
- **Docs** (`docs/content/docs/*.mdx`): detailed documentation with flags, examples, and edge cases.
- **README** (`README.md`): dev-facing perspective — quick setup, commands, what's new.

Not every change touches all three. A new doctor check updates docs only. A new command updates all three. Decide per change, but always consider all three.

## Parallel Agents
- Research tasks: spawn multiple agents with different lenses
- Stress testing: use one Bash call with a shell loop (agents can't run Bash — see memory)
- Code review: spawn an Explore agent to audit while continuing to build
- Never spawn agents for sequential/dependent work — only for independent parallel tasks
