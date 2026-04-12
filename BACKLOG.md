# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P1 = soon, P2 = when relevant, P3 = if circumstances change.

---

## [P0] Memory: MMR Diversity Selection
Maximal Marginal Relevance for injection. Prevents injecting 5 memories on the same topic. Picks the best one, penalizes similar ones, gives the slot to a different topic. Matters at 100+ memories.

## [P0] Memory: Auto-Relation Discovery
When storing a new memory, search for related existing memories and auto-create relations (relates_to, extends, contradicts). More connections improve injection scoring and decay resistance. Currently only contradiction detection is automated.

## [P0] Memory: lp-migrate-memory Skill for Local Placement
Local scope memory install skips skill creation (skills go to `.claude/skills/` which is committed). Should install to `~/.claude/skills/` (global scope) instead so local users can still migrate legacy memories.

## [P0] Memory: Skip lp-migrate-memory for New Projects
Install should check `~/.claude/projects/*/memory/` for files matching the current project slug. No legacy memory files = skip installing the migration skill. Avoids clutter for projects that never used built-in auto-memory.

## [P0] Memory: Show Content Preview for Untitled Memories
Dashboard and context injection show "(untitled)" for memories stored without a title. Should display first ~30 chars of content instead, so they're identifiable without opening the detail view.

## [P3] Kill: Doctor --watch Mode
Nobody watches their Claude config for changes. Consider removing or hiding behind an undocumented flag.

## [P3] Docs: .mdx Extension Middleware
Fumadocs supports middleware that rewrites `/docs/foo.mdx` to the per-page markdown route, letting AI agents append `.mdx` to any doc URL. Not possible on GitHub Pages (static export). Revisit if we switch to Vercel hosting.

## Launch Campaign
- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch
