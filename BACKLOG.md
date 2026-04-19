# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P1 = big bug or must-have feature, P2 = real pain with clear evidence, P3 = nice-to-have / speculative / conditional.

---

## [P1] Memory: Bare `memory` Command Shows Stats Even When MCP Not Registered
`claude-launchpad memory` decides "installed" by checking for the `memory context` SessionStart hook in settings — never checks whether the MCP server is actually registered (`.mcp.json` or user/local scope). Projects can have hooks + permissions + populated DB but no MCP registration, yet bare `memory` shows stats as if healthy and there's no explicit `memory install` subcommand to force re-registration. Fix: either (a) `isMemoryInstalled()` must also verify MCP registration before returning true, or (b) add explicit `memory install` subcommand that always runs the flow. Ideally both. Reproduced on lna-agentforce-statista 2026-04-19.

## [P1] Memory Install: Respect allowedMcpServers Allowlist
`claude-launchpad memory install` calls `claude mcp add agentic-memory` which silently fails with "not allowed by enterprise policy" when `settings.json` has an `allowedMcpServers` allowlist excluding it. Install prints "Could not enable memory tools automatically" and exits 0, leaving a half-configured project. Fix: read allowlist before `mcp add`, prepend `agentic-memory` if missing. Reproduced on hyperterminal 2026-04-19.

## [P1] Memory Sync: Silent Failure on Expired gh Auth
`memory push` / `memory pull` log the error via `handleSyncErrors` but return cleanly with exit 0 when `gh` auth token is expired. User thinks sync succeeded; memories drift across devices. Fix: re-throw or `process.exit(1)` in `src/commands/memory/index.ts:7-13`. Data-integrity risk.

## [P1] Memory Sync: Gist Transport Swallows execSync Errors
`utils/gist-transport.ts` (readGistFile, listGistFiles, updateGistFiles) wraps execSync in try/catch returning null/[]. Network blip during push → function returns undefined → runPush prints "Push complete" with no actual gist write. Next pull on another machine fetches stale data. Fix: let errors bubble, remove sentinel returns.

## [P1] Init: `-y` on Existing Project Has Undefined Semantics
`src/commands/init/index.ts:56-59` — when CLAUDE.md exists and `--yes` is set, init prints "Use doctor --fix" and exits. User thinks init ran; config untouched. Fix: either (a) `-y` means overwrite without asking, or (b) fail-fast with a clear error. Current behavior is neither.

## [P2] Story Tightening: Unify the Pitch Across Surfaces
Landing page leads with outcome ("credentials readable, rules 80%"), README with technical fact ("80%/100%"), CLI help with vague "measurably good", package.json lists 5 co-equal features. Memory gets 54 README lines vs doctor's 24 — optional feature drowning core pipeline. Fix: rewrite package.json description to front the pipeline, lift landing's outcome framing into README opener, sharpen CLI help, demote memory to "optional add-on" everywhere.

## [P2] Code: Extract Shared hook-builder.ts
Hook-patching logic duplicated 3 ways: `install.ts` (addSessionStart/End/Pull), `fixer.ts` (12 hook-adding fns), `fixer-memory.ts` (placement-aware variants). Dedup check repeated 4+ times. Extract `src/lib/hook-builder.ts` with single `addOrUpdateHook(settings, placement, event, matcher, dedup, prepend?)` used by all three. Prereq for safely adding new hooks.

## [P2] Code: Settings Parse Error Inconsistency
`lib/settings.ts::readSettingsJson` returns `{}` on JSON parse error; `lib/parser.ts:91-94` returns `null` for the same case. Callers check `!== null` vs `!== undefined` inconsistently. Corrupted settings.json silently loses hooks/permissions in one path, surfaces as null in the other. Fix: standardize on null + `log.warn()`.

## [P2] Memory Install: Preflight Checks
`runInstall` calls `claude mcp add` and checks `isGhAuthenticated()` mid-flow. If Claude CLI missing, steps 1–2 succeed, step 3 fails silently. Add preflight: check `claude` on PATH, warn on missing `gh` (sync optional). Pattern exists in `eval/index.ts:248`.

## [P2] Doctor: Detect Orphaned MCP Permission Entries
MCP analyzer doesn't cross-reference `permissions.allow` entries of shape `mcp__<server>__*` against registered servers. Stale entry after rename silently blocks all tool calls. Report unregistered server references as warnings.

## [P2] Doctor: Detect MCP Allowlist Excluding Memory
When memory hooks are wired but `allowedMcpServers` is present without `agentic-memory`, setup is functionally broken (hooks fire, tools absent). Add cross-check between memory-hook presence and allowlist membership.

## [P3] Eval: Precondition Check
`eval` runs scenarios even when project has no CLAUDE.md/settings. Reports "0 passed" with no hint the project isn't initialized. Add `parseClaudeConfig` check at start (same pattern as doctor), fail-fast with "Run init first".

## [P3] Code: Split fixer.ts
426 lines, 48 FIX_TABLE entries + inline fix impls. Move impls to `fixers/hooks.ts`, `fixers/quality.ts`, `fixers/rules.ts`, `fixers/permissions.ts`. Tests become per-fixer. Not urgent — file works.

## [P3] Code: watcher.ts Type Cast + Dead Backlog Generator
`watcher.ts:53` uses `as unknown as { parentPath?: string }` for Node readdir — needs proper type or vendored fix. Also verify `init/generators/backlog.ts::generateBacklogMd` is actually called by init flow; delete if dead.

## [P3] Memory: Auto-Relation Discovery
Search related memories at store time, auto-create relations. Speculative — Sprint 26 oracle at 71.7% is healthy. Revisit only if injection quality regresses.

## [P3] Memory: lp-migrate-memory Local Placement + Skip on New Projects
Local scope skips skill creation (skill goes to committed `.claude/skills/`); should install to `~/.claude/skills/`. Also: new projects with no `~/.claude/projects/*/memory/` files get a useless migration skill — check + skip. Both edge cases on sunset feature.

## [P3] Memory: Auto-Title Untitled Memories at Store Time
Auto-derive title from first ~40 chars when `memory_store` is called without one. Root-cause fix for "(untitled)" in dashboard/injection.

## [P3] Doctor: Plan/Apply Architecture (v2.0.0 breaking)
Replace direct-write `--fix` with Terraform-style plan/apply. Ship only if users complain about mangling. Sprint 25 LP-STUB markers already address most of this. 32-36h, breaking release.

## [P3] Kill: Doctor --watch Mode
Nobody watches their Claude config for changes. Remove or hide behind undocumented flag.

## [P3] Docs: .mdx Extension Middleware
Fumadocs middleware for `/docs/foo.mdx` → per-page markdown route. Blocked by GitHub Pages static export. Revisit on Vercel migration.

## Launch Campaign
- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch
