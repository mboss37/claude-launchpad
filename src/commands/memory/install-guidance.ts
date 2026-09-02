import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MemoryPlacement } from "../../types/index.js";

export const MEMORY_GUIDANCE = `
## Memory (agentic-memory)
This project uses **agentic-memory** for persistent memory across sessions.
- **DO NOT** use the built-in auto-memory system (~/.claude/projects/*/memory/)
- Memory context is **automatically injected** at session start via SessionStart hook - no need to call memory_recent manually
- Use \`memory_search\` to find specific memories by keyword
- Use \`memory_store\` to save decisions, gotchas, and learnings worth remembering
- Use \`memory_stats\` to check memory health
- **STORE IMMEDIATELY** when: a dependency strategy changes, an architecture decision is made, a convention is established, a bug pattern is discovered, or a feature is killed/added
`;

const CURSOR_MEMORY_GUIDANCE = `
## Memory (agentic-memory)
This project uses **agentic-memory** for persistent memory across sessions.
- Use \`memory_search\` at session start — Cursor does not auto-inject memories
- Use \`memory_store\` to save decisions, gotchas, and learnings worth remembering
- Use \`memory_stats\` to check memory health
- **STORE IMMEDIATELY** when: a dependency strategy changes, an architecture decision is made, a convention is established, a bug pattern is discovered, or a feature is killed/added
`;

export function injectClaudeMdGuidance(
  projectDir: string,
  placement: MemoryPlacement,
): boolean {
  const claudeMdPath =
    placement === "local"
      ? join(projectDir, ".claude", "CLAUDE.md")
      : join(projectDir, "CLAUDE.md");

  let content = "";
  try {
    content = readFileSync(claudeMdPath, "utf-8");
  } catch {
    if (placement !== "local") return false;
    mkdirSync(join(projectDir, ".claude"), { recursive: true });
    content = "# Local Claude Config\n";
  }

  if (/^## Memory( \(agentic-memory\))?\s*$/m.test(content)) return false;
  writeFileSync(
    claudeMdPath,
    `${content.trimEnd()}\n${MEMORY_GUIDANCE}`,
    "utf-8",
  );
  return true;
}

export function injectAgentsMdGuidance(projectDir: string): boolean {
  const path = join(projectDir, "AGENTS.md");
  if (!existsSync(path)) return false;
  const content = readFileSync(path, "utf-8");
  if (/^## Memory( \(agentic-memory\))?\s*$/m.test(content)) return false;
  writeFileSync(
    path,
    `${content.trimEnd()}\n${CURSOR_MEMORY_GUIDANCE}`,
    "utf-8",
  );
  return true;
}

const MIGRATE_MEMORY_SKILL = `---
name: lp-migrate-memory
description: Migrate legacy Claude Code auto-memory files (~/.claude/projects/*/memory/*.md) into agentic-memory. Use when setting up agentic-memory on a project that already has built-in memories.
allowed-tools: Read, Glob, Grep, mcp__agentic-memory__memory_store, mcp__agentic-memory__memory_search
---

# Migrate Legacy Claude Code Memories

Migrate memory files from Claude Code's built-in auto-memory system into agentic-memory.

## Steps

1. **Find legacy memory files** for this project:
   - Scan \`~/.claude/projects/*/memory/*.md\` for directories whose slug matches the current project path
   - The slug format is the absolute path with \`/\` replaced by \`-\` and leading \`-\` (e.g. \`-Users-john-projects-myapp\`)
   - Also check \`~/.claude/projects/*/memory/team/*.md\` for team memories

2. **For each memory file found**, read it and parse:
   - YAML frontmatter: \`name\`, \`description\`, \`type\` (user/feedback/project/reference)
   - Body content (everything after the frontmatter closing \`---\`)
   - Skip \`MEMORY.md\` (it's just an index file, not a memory)

3. **Before storing**, check for duplicates:
   - Call \`memory_search\` with the memory description or first 100 chars of content
   - If a close match exists (same topic), skip it and report

4. **Map types and store** each memory via \`memory_store\`:
   - \`user\` -> type: \`semantic\`, tags: [\`user\`, \`migrated\`], importance: 0.7
   - \`feedback\` -> type: \`semantic\`, tags: [\`feedback\`, \`migrated\`], importance: 0.8
   - \`project\` -> type: \`semantic\`, tags: [\`project\`, \`migrated\`], importance: 0.6
   - \`reference\` -> type: \`semantic\`, tags: [\`reference\`, \`migrated\`], importance: 0.5
   - Use the frontmatter \`name\` as the title
   - Use the body content as the memory content
   - Set source: \`import\`
   - Adjust importance up/down based on the content (decisions and gotchas deserve higher importance)

5. **Report results**: list what was migrated, what was skipped (duplicates), and what failed

## Important

- Do NOT delete the original files - the user can do that manually after verifying
- Do NOT migrate content that is purely derived from code (architecture, file structure) - it belongs in CLAUDE.md, not memory
- If unsure about a memory's value, migrate it anyway - the decay system will naturally prune low-value memories over time
`;

const SKILLS: Readonly<Record<string, string>> = {
  "lp-migrate-memory": MIGRATE_MEMORY_SKILL,
};

export function installMemorySkills(projectDir: string): number {
  const skillsDir = join(projectDir, ".claude", "skills");
  let installed = 0;
  for (const [name, content] of Object.entries(SKILLS)) {
    const skillPath = join(skillsDir, name, "SKILL.md");
    if (existsSync(skillPath)) continue;
    mkdirSync(join(skillsDir, name), { recursive: true });
    writeFileSync(skillPath, content.trimStart(), "utf-8");
    installed++;
  }
  return installed;
}
