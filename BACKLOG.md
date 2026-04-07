# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

---

## ~~[KILLED] Memory: Bulk Purge by Project~~
TUI dashboard already has single and bulk delete. Separate CLI command adds confusion with no value.

## [P2] Memory: MMR Diversity Selection
Maximal Marginal Relevance for injection. Prevents injecting 5 memories on the same topic. Picks the best one, penalizes similar ones, gives the slot to a different topic. Matters at 100+ memories.

## [P2] Memory: Exploration Slots
Reserve 1/8 injection slots for random discovery. Memories that get searched after injection rise in rank; ones that don't fade out. Multi-armed bandit without ML training. Matters at 100+ memories.

## [P2] Refactor: Immutability Violations in Fixer and Install
Pre-existing mutation patterns in `src/commands/doctor/fixer.ts` and `src/commands/memory/subcommands/install.ts`:
- `fixer.ts:438` — `delete hooks.Stop` mutates directly, should create new object without key
- `fixer.ts:122` — `hookList.push(entry)` mutates array before spread
- `install.ts:96,102,128,150` — direct assignment to settings/hooks objects (`settings['autoMemoryEnabled'] = false`, `allowList.push(tool)`)
All violate the immutability convention. Low risk (works fine), but should be cleaned up to match project standards.

## [P1] Skill: /lp-health — Session Health Check
Skill (not CLI command — needs to run inside the session). Reports on current session health:
- Context window usage (how much is consumed vs remaining)
- SessionStart hook injection size (token cost of TASKS.md, memory context, CLAUDE.md)
- Waste detection: unused/stale memories injected, oversized CLAUDE.md sections, redundant hooks
- Issues: missing hooks, broken MCP tools, settings drift from doctor recommendations
- Actionable suggestions: "your memory injection is 40% of budget, consider pruning"

## [P1] Doctor: Detect New Hook Events and Types
Claude Code now supports 28 hook events (we only check 4) and 4 hook types (command, prompt, http, agent). Highest-value additions for doctor to detect and recommend:
- `SessionEnd` — cleanup, memory consolidation triggers
- `UserPromptSubmit` — input validation, guardrails
- `http` hook type — webhook automation with env var interpolation
- `.claude/agents/` directory — custom agent definitions (new convention)

## [P1] Doctor: Sandbox and MCP Security Checks
Claude Code now has full sandbox config (`sandbox.filesystem`, `sandbox.network`) and MCP allow/deny lists (`allowedMcpServers`, `deniedMcpServers`). Doctor could recommend these for projects with MCP servers or security-sensitive codebases.

## [P1] Memory Sync: Harden Multi-Project Scenarios
Push/pull needs hardening for edge cases discovered in testing:
- Push with 0 memories silently creates empty gist files (fixed: now warns and bails)
- No way to delete a single project file from the sync gist via CLI
- Pull on a project with no local DB creates an empty DB then merges — should warn
- `--all` push on a machine with only empty projects shouldn't create a gist
- Consider `memory sync status` to show what's in the gist vs local
- Consider `memory sync clean <project>` to remove a project from the gist

## [P2] Docs: .mdx Extension Middleware
Fumadocs supports middleware that rewrites `/docs/foo.mdx` to the per-page markdown route, letting AI agents append `.mdx` to any doc URL. Not critical with static export but nice-to-have if hosting supports rewrites.

## Launch Campaign
- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch
