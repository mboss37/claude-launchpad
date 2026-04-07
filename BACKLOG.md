# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P1 = soon, P2 = when relevant, P3 = if circumstances change.

---

## [P1] Memory Sync: Harden Multi-Project Scenarios
Push/pull needs hardening for edge cases discovered in testing:
- No way to delete a single project file from the sync gist via CLI
- Pull on a project with no local DB creates an empty DB then merges — should warn
- `--all` push on a machine with only empty projects shouldn't create a gist
- Consider `memory sync status` to show what's in the gist vs local
- Consider `memory sync clean <project>` to remove a project from the gist

## [P2] Refactor: Immutability Violations in Fixer and Install
Pre-existing mutation patterns in `src/commands/doctor/fixer.ts` and `src/commands/memory/subcommands/install.ts`:
- `fixer.ts:122` — `hookList.push(entry)` mutates array before spread
- `install.ts:96,102,128,150` — direct assignment to settings/hooks objects (`settings['autoMemoryEnabled'] = false`, `allowList.push(tool)`)
All violate the immutability convention. Low risk (works fine), but should be cleaned up to match project standards.

## [P2] Memory: MMR Diversity Selection
Maximal Marginal Relevance for injection. Prevents injecting 5 memories on the same topic. Picks the best one, penalizes similar ones, gives the slot to a different topic. Matters at 100+ memories.

## [P2] Memory: Exploration Slots
Reserve 1/8 injection slots for random discovery. Memories that get searched after injection rise in rank; ones that don't fade out. Multi-armed bandit without ML training. Matters at 100+ memories.

## [P2] Memory: Store Dedup Race Condition
Concurrent `memory_store` calls can create duplicates. The dedup guard does check-then-write without a lock, so two parallel stores with similar content both pass the check before either commits. Fix options: SQLite exclusive transaction around the check+insert, or a unique content hash constraint on the table.

## [P3] Kill: Doctor --watch Mode
Nobody watches their Claude config for changes. Consider removing or hiding behind an undocumented flag.

## [P3] Docs: .mdx Extension Middleware
Fumadocs supports middleware that rewrites `/docs/foo.mdx` to the per-page markdown route, letting AI agents append `.mdx` to any doc URL. Not possible on GitHub Pages (static export). Revisit if we switch to Vercel hosting.

## Launch Campaign
- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch
