# Changelog

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
