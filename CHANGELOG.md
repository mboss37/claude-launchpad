# Changelog

## [0.7.0] - 2026-04-01

### Added
- `memory` command - persistent, intelligent memory system for Claude Code sessions
  - SQLite-backed with FTS5 full-text search
  - Neuroscience-inspired decay model (episodic, semantic, procedural, pattern types)
  - 7 MCP tools (store, search, recent, forget, relate, stats, update)
  - SessionStart hook auto-injects relevant context, Stop hook extracts facts
  - Interactive install with confirmation prompt
  - `--dashboard` flag for memory statistics
- Doctor memory analyzer - detects memory config issues when installed
- Doctor `--fix` auto-repairs: disables auto-memory, adds MCP tool permissions, injects CLAUDE.md guidance

### Changed
- `enhance` CLI command replaced with `/lp-enhance` skill (runs inside Claude Code session)
  - Installed during `init` with global/project scope picker
  - Doctor detects missing skill, `--fix` creates it
  - Uses `.claude/skills/lp-enhance/SKILL.md` format with frontmatter
- Banner updated: "Scaffold - Diagnose - Evaluate - Remember"
- Shared settings helpers extracted to `src/lib/settings.ts`

### Removed
- `enhance` CLI command (replaced by `/lp-enhance` skill)

## [0.6.0] - 2026-03-30

### Added
- Sprint review hook: PostToolUse hook detects sprint completion in TASKS.md and nudges a quality check before committing
- Sprint Reviews section in generated CLAUDE.md

## [0.5.4] - 2026-03-29

### Added
- `--fix` now auto-adds SessionStart hook (injects TASKS.md at startup)

### Changed
- `--fix` no longer shows the before-score - only the post-fix result
- Post-fix report says "remaining issue(s) require manual intervention" instead of suggesting --fix again
- Dry-run shows fix actions, skips unfixable issues

## [0.5.3] - 2026-03-29

### Changed
- Doctor output: compact single-line issues (was 3 lines each with fix text)
- Doctor `--fix` and `--fix --dry-run` now recommend running `enhance` as next step
- Dry-run shows fix actions instead of problem messages, skips unfixable issues

## [0.5.2] - 2026-03-29

### Added
- `doctor --fix --dry-run` - preview what fixes would be applied without modifying files
- `pnpm publish:dev` / `pnpm publish:release` scripts for prerelease workflow

## [0.5.1] - 2026-03-29

### Added
- 4 new doctor checks: deprecated `includeCoAuthoredBy`, monorepo `claudeMdExcludes` hint, hook timeouts on broad matchers, auto-memory disabled without manual strategy
- SessionStart hook in init-generated settings.json - injects TASKS.md at session startup
- Doctor hooks analyzer now checks for SessionStart hook
- Attribution migration auto-fix: `--fix` migrates deprecated `includeCoAuthoredBy` to `attribution` object
- Enhance prompt: suggests path-scoped rules, `sandbox.network.allowedDomains`, `claudeMdExcludes` for monorepos
- 2 new eval scenarios: `memory-persistence`, `deferred-tracking` - 15 total
- `timeout` field parsed from hooks in settings.json

### Fixed
- `doctor --fix` now re-scans and shows updated score after applying fixes (previously required a second run)

### Changed
- Hooks analyzer score weight: 20 to 15 per issue (6 checks would bottom out too fast)
- Total tests: 91 to 99

## [0.5.0] - 2026-03-29

### Added
- Security hardening: init generates credential deny rules (`~/.ssh/*`, `~/.aws/*`, `~/.npmrc`), sandbox enabled, bypass mode disabled
- 5 new doctor checks: credential file exposure, blanket Bash approval, .env gap (hooks vs .claudeignore), bypass mode unprotected, sandbox not enabled
- 4 new auto-fixes: `--fix` adds credential deny rules, bypass disable, sandbox settings, .env to .claudeignore
- 2 new eval scenarios: `credential-read` (SSH key protection), `sandbox-escape` (.env bypass via Bash)
- Interactive eval mode: `eval` with no flags prompts for suite, runs, and model selection
- `.claudeignore` parsing added to ClaudeConfig for cross-checking with hooks

### Fixed
- `build.gradle` detection bug - `||` on two promises always returned the first (Kotlin/Gradle projects misdetected)
- Broader `.env` matching in .claudeignore fixer (handles `.env*` pattern)
- `makeConfig` test helpers missing `claudeignorePath`/`claudeignoreContent` defaults

### Changed
- Permissions analyzer score weight: 20 to 15 per issue (8 checks would bottom out too fast)
- Security eval suite: 4 to 6 scenarios
- Total tests: 71 to 91

## [0.4.3] - 2026-03-29

### Fixed
- Eval sandbox now copies user's full `.claude/` config (settings.json, rules, hooks, permissions) and `.claudeignore` - previously only a bare CLAUDE.md from the scenario was used

## [0.4.2] - 2026-03-29

### Added
- Memory & Learnings section in generated CLAUDE.md
- PostCompact hook in generated settings.json - re-injects TASKS.md after context compaction
- Deferred section in generated TASKS.md
- Doctor checks for Memory section and PostCompact hook
- `--fix` auto-adds Memory section and PostCompact hook
- Enhance prompt now suggests PostCompact hook for existing projects

## [0.4.1] - 2026-03-29

### Changed
- Refactored `tryFix()` from 73-line if/else chain to `FIX_TABLE` lookup pattern
- Refactored `detectScripts()` from 112-line if/else chain to `LANGUAGE_SCRIPTS` config object

### Added
- 13 new tests for `detectScripts()` covering all supported languages (58 to 71 tests)

## [0.4.0] - 2026-03-28

### Added
- Enhanced `init`: generates 6 files (CLAUDE.md, TASKS.md, settings.json, .gitignore, .claudeignore, conventions.md)
- `settings.json` includes `$schema` for IDE autocomplete, `permissions.deny` for security
- Destructive command blocking hooks (force-push, reset --hard, rm -rf)
- Language-specific starter rules (13 languages)

### Changed
- Init detects 20+ frameworks from manifest files + lockfiles

## [0.3.4] - 2026-03-28

### Fixed
- Security: command injection in hook generation (SAFE_FORMATTERS dict)

### Added
- Suite filtering for eval
- Eval report output to `.claude/eval/`

## [0.3.0] - 2026-03-28

### Added
- `doctor --watch`: polling-based live score updates
- `.claudeignore` generation in `--fix`
- `enhance` budget cap (120 lines)
- Tech Stack section in generated CLAUDE.md

## [0.2.2] - 2026-03-28

### Added
- Plugin submitted to marketplace
- 50 tests, 60KB package size

## [0.1.0] - 2026-03-28

### Added
- Initial npm publish
- `init`, `doctor`, `enhance`, `eval` commands
- 7 analyzers, 7 eval scenarios
- Stress tested across 8 stacks
