# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

---

## [P0] Memory: Multi-Device Sync
Expert panel decision (2026-04-04): git-based sync with secret scanning. Full spec below.

### Commands
- `memory export` — export all memories to `~/.agentic-memory/export.json`
- `memory import [path]` — import from JSON, merge with local DB
- `memory export --project <name>` — export only one project's memories

### Export Format
```json
{
  "version": 1,
  "exported_at": "2026-04-04T...",
  "machine_id": "mac-mini-mihael",
  "memories": [
    {
      "id": "uuid",
      "type": "semantic",
      "title": "...",
      "content": "...",
      "tags": ["#decision"],
      "importance": 0.7,
      "project": "claude-launchpad",
      "access_count": 5,
      "injection_count": 3,
      "created_at": "...",
      "updated_at": "...",
      "last_accessed": "..."
    }
  ],
  "relations": [
    { "source_id": "uuid", "target_id": "uuid", "type": "supports" }
  ]
}
```
- Sorted by `id` for deterministic diffs
- Includes relations so linked memories stay linked

### Import Merge Strategy
1. Hash each memory by `id`
2. If `id` exists locally: compare `updated_at`, keep newer (last-write-wins)
3. If `id` not in local DB: insert
4. If `id` in local but not in import: keep (no deletions via import)
5. Relations: union merge (add missing, never remove)
6. After import: run decay recalculation on imported memories

### Secret Scanning (on export)
Regex scan content + title before writing JSON:
- `sk-[a-zA-Z0-9]{20,}` (OpenAI)
- `ghp_[a-zA-Z0-9]{36}` (GitHub)
- `AKIA[0-9A-Z]{16}` (AWS)
- `xoxb-[0-9]+-[a-zA-Z0-9]+` (Slack)
- `postgresql://`, `mongodb://`, `redis://` (connection strings)
- Generic `password\s*[:=]\s*\S+` pattern

Action: warn per match, ask to proceed or abort. `--force` skips prompt.

### Sync Workflow (user-managed)
```bash
# On machine A (after a session):
claude-launchpad memory export
# Commit to private dotfiles repo, or let iCloud/Dropbox sync the file

# On machine B (before a session):
claude-launchpad memory import ~/.agentic-memory/export.json
```
No automatic sync. No hooks. No cloud service. User decides transport.

### Implementation Files
- `src/commands/memory/subcommands/export.ts` — new
- `src/commands/memory/subcommands/import.ts` — new
- `src/commands/memory/utils/secret-scan.ts` — new
- `src/commands/memory/index.ts` — register `export` + `import` subcommands
- `src/commands/memory/storage/memory-repo.ts` — add `upsertFromImport()` method

### Out of Scope
- Automatic sync (hooks, watchers, cron)
- Cloud storage backends (Turso deferred to P2)
- CRDTs (killed — overengineered for single-user multi-device)
- Vector embeddings in export (not portable across sqlite-vec versions)

---

## [P1] Memory: Dashboard Delete
`d` keybinding in TUI dashboard with confirmation prompt. `hardDelete(id)` already exists in MemoryRepo.

## [P1] Memory: Bulk Purge by Project
`memory --purge <project>` to delete all memories for a project. Useful for cleanup after project archival.

## [P2] Memory: MMR Diversity Selection
Maximal Marginal Relevance for injection. Prevents injecting 5 memories on the same topic. Picks the best one, penalizes similar ones, gives the slot to a different topic. Matters at 100+ memories.

## [P2] Memory: Exploration Slots
Reserve 1/8 injection slots for random discovery. Memories that get searched after injection rise in rank; ones that don't fade out. Multi-armed bandit without ML training. Matters at 100+ memories.

## Launch Campaign
- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch
