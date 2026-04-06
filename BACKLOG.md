# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

---

## [P1] Memory: Bulk Purge by Project
`memory --purge <project>` to delete all memories for a project. Useful for cleanup after project archival.

## [P2] Memory: MMR Diversity Selection
Maximal Marginal Relevance for injection. Prevents injecting 5 memories on the same topic. Picks the best one, penalizes similar ones, gives the slot to a different topic. Matters at 100+ memories.

## [P2] Memory: Exploration Slots
Reserve 1/8 injection slots for random discovery. Memories that get searched after injection rise in rank; ones that don't fade out. Multi-armed bandit without ML training. Matters at 100+ memories.

## [P1] Docs: Command Responsibility Matrix
Add a matrix table to docs showing every command and skill with what it does:
| Responsibility | `init` | `doctor --fix` | `/lp-enhance` | `eval` | `memory` |
Shows which tool handles what (scaffolding, detection, AI analysis, testing, persistence) so users understand the pipeline and where each tool fits.

## [P1] Skill: /lp-health — Session Health Check
Skill (not CLI command — needs to run inside the session). Reports on current session health:
- Context window usage (how much is consumed vs remaining)
- SessionStart hook injection size (token cost of TASKS.md, memory context, CLAUDE.md)
- Waste detection: unused/stale memories injected, oversized CLAUDE.md sections, redundant hooks
- Issues: missing hooks, broken MCP tools, settings drift from doctor recommendations
- Actionable suggestions: "your memory injection is 40% of budget, consider pruning"

## [P2] Docs: .mdx Extension Middleware
Fumadocs supports middleware that rewrites `/docs/foo.mdx` to the per-page markdown route, letting AI agents append `.mdx` to any doc URL. Not critical with static export but nice-to-have if hosting supports rewrites.

## Launch Campaign
- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch
