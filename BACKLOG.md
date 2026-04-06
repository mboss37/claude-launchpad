# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

---

## [P1] Enhance: Path-Scoped Rules Generation
`/lp-enhance` should detect project structure and suggest path-scoped `.claude/rules/` files with `paths` frontmatter. Detect monorepos (workspaces, nx.json, lerna.json), distinct areas (api vs frontend vs docs), and generate focused rules per area. Stack-specific conventions (e.g., "use Server Components by default" for Next.js app/ dir) should be scoped to matching paths, not global.

## [P1] Memory: Dashboard Delete
`d` keybinding in TUI dashboard with confirmation prompt. `hardDelete(id)` already exists in MemoryRepo.

## [P1] Memory: Bulk Purge by Project
`memory --purge <project>` to delete all memories for a project. Useful for cleanup after project archival.

## [P2] Memory: MMR Diversity Selection
Maximal Marginal Relevance for injection. Prevents injecting 5 memories on the same topic. Picks the best one, penalizes similar ones, gives the slot to a different topic. Matters at 100+ memories.

## [P2] Memory: Exploration Slots
Reserve 1/8 injection slots for random discovery. Memories that get searched after injection rise in rank; ones that don't fade out. Multi-armed bandit without ML training. Matters at 100+ memories.

## [P1] Memory: TUI Dashboard Live Reload
Dashboard (blessed TUI) loads data once at startup and never refreshes. If the underlying DB changes (e.g. `memory pull`, `memory.db` deleted), the dashboard shows stale data until restarted. Should watch `memory.db` with `fs.watch` and reload on change.

## [P1] Enhance: Eval Scenario Generation
After rewriting CLAUDE.md, `/lp-enhance` should suggest 2-3 eval scenarios tailored to the project (e.g. "does Claude respect our off-limits?"). Closes the `init → doctor → enhance → eval` loop.

## [P2] Enhance: .claudeignore Review
`/lp-enhance` reads the codebase but never checks if `.claudeignore` patterns are sensible for the detected stack. Should flag missing or wrong patterns.

## [P1] Docs: Command Responsibility Matrix
Add a matrix table to docs showing every command and skill with what it does:
| Responsibility | `init` | `doctor --fix` | `/lp-enhance` | `eval` | `memory` |
Shows which tool handles what (scaffolding, detection, AI analysis, testing, persistence) so users understand the pipeline and where each tool fits.

## Launch Campaign
- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch
