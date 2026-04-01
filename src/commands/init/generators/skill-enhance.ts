/**
 * Generates the /lp-enhance skill markdown content.
 * This skill replaces the old `enhance` CLI command — runs inside
 * the user's active Claude Code session instead of spawning a separate process.
 */
export function generateEnhanceSkill(): string {
  return `---
name: lp-enhance
description: AI-improve your CLAUDE.md based on codebase analysis. Fills in architecture, conventions, guardrails, and suggests hooks and MCP servers.
disable-model-invocation: true
---

# lp-enhance - AI-powered CLAUDE.md improver

Read CLAUDE.md and the project's codebase, then update CLAUDE.md to fill in missing or incomplete sections.

## Budget Rule

CLAUDE.md must stay UNDER 120 lines of actionable content (not counting headings, blank lines, or comments). Claude Code starts ignoring rules past ~150 instructions. If you need more detail, create .claude/rules/ files instead:
- Create .claude/rules/conventions.md for detailed coding patterns
- Create .claude/rules/architecture.md for detailed structure docs
- Keep CLAUDE.md to HIGH-LEVEL summaries only (3-5 bullets per section max)

## Sections to fill or preserve (DO NOT remove existing sections)

1. **## Stack** - if missing or incomplete, detect and add language, framework, package manager
2. **## Architecture** - 3-5 bullet points describing the codebase shape (not a full directory tree)
3. **## Conventions** - max 8 key patterns. Move detailed rules to .claude/rules/conventions.md
4. **## Off-Limits** - max 8 guardrails specific to this project
5. **## Memory & Learnings** - max 6 bullets. If missing, add instructions for using the built-in memory system: what to save (gotchas, decisions, deferred issues, references), where (project vs global memory), and the rule to check existing memories before creating duplicates
6. **## Key Decisions** - only decisions that affect how Claude should work in this codebase
7. **MCP server suggestions** - look at what external services the project uses (databases, APIs, storage). If you spot Postgres, Redis, Stripe, GitHub API, or similar, suggest relevant MCP servers. Print as suggestions at the end, not in CLAUDE.md.

## Hook review

Also review .claude/settings.json hooks:
- Read the existing hooks in .claude/settings.json
- If you see project-specific patterns that deserve hooks (e.g., protected directories, test file patterns, migration files), suggest adding them
- If no PostCompact hook exists, suggest adding one that re-injects TASKS.md after context compaction
- If no SessionStart hook exists, suggest adding one that injects TASKS.md at session startup
- DO NOT overwrite existing hooks - only add new ones specific to this project
- Print hook suggestions at the end with the exact JSON to add, don't modify settings.json directly

## Advanced configuration opportunities

- If the project has both app code and tests, suggest creating path-scoped .claude/rules/ files with paths: frontmatter
- If the project uses external APIs, suggest sandbox.network.allowedDomains to restrict outbound traffic
- If you detect a monorepo, suggest claudeMdExcludes in settings.json

## Rules

- Don't remove existing content - only add or improve
- Be specific to THIS project, not generic advice
- Use bullet points, not paragraphs
- If a section would exceed 8 bullets, split into a .claude/rules/ file and reference it
- After editing, count the actionable lines. If over 120, move content to rules files until under
- Run \`claude-launchpad doctor\` after to verify score improved
`;
}
