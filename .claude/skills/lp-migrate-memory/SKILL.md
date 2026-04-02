---
name: lp-migrate-memory
description: Migrate legacy Claude Code auto-memory files (~/.claude/projects/*/memory/*.md) into agentic-memory. Use when setting up agentic-memory on a project that already has built-in memories.
allowed-tools: Read, Glob, Grep, mcp__agentic-memory__memory_store, mcp__agentic-memory__memory_search
---

# Migrate Legacy Claude Code Memories

Migrate memory files from Claude Code's built-in auto-memory system into agentic-memory.

## Steps

1. **Find legacy memory files** for this project:
   - Scan `~/.claude/projects/*/memory/*.md` for directories whose slug matches the current project path
   - The slug format is the absolute path with `/` replaced by `-` and leading `-` (e.g. `-Users-john-projects-myapp`)
   - Also check `~/.claude/projects/*/memory/team/*.md` for team memories

2. **For each memory file found**, read it and parse:
   - YAML frontmatter: `name`, `description`, `type` (user/feedback/project/reference)
   - Body content (everything after the frontmatter closing `---`)
   - Skip `MEMORY.md` (it's just an index file, not a memory)

3. **Before storing**, check for duplicates:
   - Call `memory_search` with the memory description or first 100 chars of content
   - If a close match exists (same topic), skip it and report

4. **Map types and store** each memory via `memory_store`:
   - `user` -> type: `semantic`, tags: [`user`, `migrated`], importance: 0.7
   - `feedback` -> type: `semantic`, tags: [`feedback`, `migrated`], importance: 0.8
   - `project` -> type: `semantic`, tags: [`project`, `migrated`], importance: 0.6
   - `reference` -> type: `semantic`, tags: [`reference`, `migrated`], importance: 0.5
   - Use the frontmatter `name` as the title
   - Use the body content as the memory content
   - Set source: `import`
   - Adjust importance up/down based on the content (decisions and gotchas deserve higher importance)

5. **Report results**: list what was migrated, what was skipped (duplicates), and what failed

## Important

- Do NOT delete the original files - the user can do that manually after verifying
- Do NOT migrate content that is purely derived from code (architecture, file structure) - it belongs in CLAUDE.md, not memory
- If unsure about a memory's value, migrate it anyway - the decay system will naturally prune low-value memories over time
