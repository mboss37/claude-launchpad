# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

---

## [P0] Memory: Multi-Device Sync (Push/Pull via Private GitHub Gist)
Expert panel reviewed (2026-04-05). Simplified to bare minimum after discussion.

### How It Works
- Private GitHub Gist as transport (unlisted, requires URL to access)
- `gh` CLI handles auth (already on the machine)
- Gist ID stored in `~/.agentic-memory/sync-config.json`
- Full blob sync — no delta, no manifest. At 50-500 memories (~1MB) just overwrite the whole thing
- Pull-before-push to prevent overwrites
- Last-write-wins by `updated_at` for conflicts

### Commands
```bash
memory push                    # serialize all memories → push to gist
memory pull                    # fetch gist → merge into local SQLite
memory push --project <name>   # push only one project
memory pull --project <name>   # pull only one project
```

### Data Format (single gist file: `agentic-memory-sync.json`)
```json
{
  "version": 1,
  "machine_id": "mac-mini-mihael",
  "pushed_at": "2026-04-05T...",
  "memories": [
    {
      "id": "uuid", "type": "semantic", "title": "...", "content": "...",
      "tags": ["#decision"], "importance": 0.7, "project": "claude-launchpad",
      "access_count": 5, "injection_count": 3,
      "created_at": "...", "updated_at": "...", "last_accessed": "..."
    }
  ],
  "relations": [
    { "source_id": "uuid", "target_id": "uuid", "type": "supports" }
  ]
}
```

### Sync Protocol
**Push:** pull first → merge → serialize all memories → update gist
**Pull:** fetch gist → for each memory: if new insert, if exists keep newer by `updated_at`
**First push:** confirm gist creation (`Create a private GitHub Gist for memory sync? [Y/n]`)

### Error Handling
- `gh` not installed: `Memory sync requires the GitHub CLI. Install: https://cli.github.com/`
- `gh` not authed: `Run: gh auth login`

### Implementation Files
- `src/commands/memory/subcommands/push.ts` — new
- `src/commands/memory/subcommands/pull.ts` — new
- `src/commands/memory/utils/gist-transport.ts` — new (create/read/update gist via `gh`)
- `src/commands/memory/index.ts` — register push/pull subcommands
- `src/commands/memory/storage/memory-repo.ts` — add `getAllForSync()`, `upsertFromSync()`

### Out of Scope (add when needed)
- Delta sync / manifest (not needed at <500 memories)
- Encryption (private gist is sufficient)
- Lamport counters (clock skew unlikely for single user)
- Tombstones / deletion propagation (add if users request)
- Auto-sync (watchers, cron)
- `memory sync` command (hides conflict direction)

---

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
