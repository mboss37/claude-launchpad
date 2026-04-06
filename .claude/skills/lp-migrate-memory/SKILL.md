---
name: lp-migrate-memory
description: |
  Migrate legacy Claude Code auto-memory files into agentic-memory.
  TRIGGER when: user asks to migrate memories, port old memories, or has just installed agentic-memory on a project with existing built-in memories.
  DO NOT TRIGGER when: user is storing new memories, searching, or using memory normally.
allowed-tools: Read, Glob, Grep, mcp__agentic-memory__memory_store, mcp__agentic-memory__memory_search
argument-hint: (no arguments needed)
---

# Migrate Legacy Claude Code Memories

Migrate memory files from Claude Code's built-in auto-memory system into agentic-memory.

## Phase 1: Discover

1. Scan `~/.claude/projects/*/memory/*.md` for directories matching the current project
2. The slug format is the absolute path with `/` replaced by `-` (e.g., `-Users-john-projects-myapp`)
3. Also check `~/.claude/projects/*/memory/team/*.md` for team memories
4. Skip `MEMORY.md` (it's an index file, not a memory)

**Done when:** you have a list of memory files to migrate.

## Phase 2: Parse and Deduplicate

For each memory file:
1. Parse YAML frontmatter: `name`, `description`, `type` (user/feedback/project/reference)
2. Extract body content (everything after closing `---`)
3. Call `memory_search` with the description or first 100 chars
4. If a close match exists, mark as skip (duplicate)

**Done when:** each file is classified as migrate or skip.

## Phase 3: Store

Map types and store each non-duplicate via `memory_store`:
- `user` -> type: semantic, tags: [user, migrated], importance: 0.7
- `feedback` -> type: semantic, tags: [feedback, migrated], importance: 0.8
- `project` -> type: semantic, tags: [project, migrated], importance: 0.6
- `reference` -> type: semantic, tags: [reference, migrated], importance: 0.5

Use frontmatter `name` as title, body as content, source: import.
Adjust importance based on content (decisions and gotchas deserve higher).

## Phase 4: Report

List what was migrated, skipped (duplicates), and failed.

**Important:**
- Do NOT delete original files. The user verifies first.
- Do NOT migrate content derived from code (architecture, file structure). That belongs in CLAUDE.md.
- If unsure about value, migrate it. The decay system prunes low-value memories naturally.
