# Changelog

## [0.4.3] — 2026-03-29

### Fixed
- Eval sandbox now copies user's full `.claude/` config (settings.json, rules, hooks, permissions) and `.claudeignore` — previously only a bare CLAUDE.md from the scenario was used, making eval test Claude itself rather than the user's configuration

### Changed
- Updated README and docs to explain how eval sandbox works (config copied, code not copied)

## [0.4.2] — 2026-03-29

### Added
- `## Memory & Learnings` section in generated CLAUDE.md — teaches Claude when/what/where to save memories
- `PostCompact` hook in generated settings.json — re-injects TASKS.md after context compaction for session continuity
- `## Deferred` section in generated TASKS.md — parking lot for known issues not urgent enough for current sprint
- Doctor now checks for Memory section in CLAUDE.md quality analyzer
- Doctor now checks for PostCompact hook in hooks analyzer
- `--fix` auto-adds Memory section and PostCompact hook
- Enhance prompt now fills in Memory & Learnings section and suggests PostCompact hook for existing projects

## [0.4.1] — 2026-03-29

### Changed
- Refactored `tryFix()` from 73-line if/else chain to `FIX_TABLE` lookup pattern
- Refactored `detectScripts()` from 112-line if/else chain to `LANGUAGE_SCRIPTS` config object
- README: added `cd your-project` to install instructions, removed Cost column from command table

### Added
- 13 new tests for `detectScripts()` covering all supported languages (58 → 71 tests)

## [0.4.0] — 2026-03-28

### Added
- Enhanced `init`: generates 6 files (CLAUDE.md, TASKS.md, settings.json, .claude/.gitignore, .claudeignore, .claude/rules/conventions.md)
- `settings.json` now includes `$schema` for IDE autocomplete, `permissions.deny` for security
- Destructive command blocking hooks (force-push, reset --hard, rm -rf)
- Language-specific starter rules (13 languages)
- Tailwind docs page rebuild

### Changed
- Init detects 20+ frameworks from manifest files + lockfiles

## [0.3.4] — 2026-03-28

### Fixed
- Security: command injection in hook generation (SAFE_FORMATTERS dict)

### Added
- 5 persona reviews incorporated
- Tailwind redesign for landing page
- Glossary in README
- Suite filtering for eval
- Eval report output to `.claude/eval/`

## [0.3.0] — 2026-03-28

### Added
- `doctor --watch`: polling-based live score updates
- `.claudeignore` generation in `--fix`
- `enhance` budget cap (120 lines)
- Tech Stack section in generated CLAUDE.md

## [0.2.2] — 2026-03-28

### Added
- Plugin submitted to marketplace
- Docs page, privacy policy
- 50 tests, 60KB package size

## [0.1.0] — 2026-03-28

### Added
- Initial npm publish
- `init`, `doctor`, `enhance`, `eval` commands
- 7 analyzers, 7 eval scenarios
- Stress tested across 8 stacks
