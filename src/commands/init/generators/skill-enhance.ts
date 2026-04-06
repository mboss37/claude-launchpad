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

CLAUDE.md must stay UNDER 200 lines of actionable content (not counting headings, blank lines, or comments). Claude Code starts ignoring rules past ~250 instructions. If you need more detail, create .claude/rules/ files instead:
- Create .claude/rules/conventions.md for detailed coding patterns
- Create .claude/rules/architecture.md for detailed structure docs
- Keep CLAUDE.md to HIGH-LEVEL summaries only (3-5 bullets per section max)

## Sections to fill or preserve (DO NOT remove existing sections)

1. **## Stack** - if missing or incomplete, detect and add language, framework, package manager
2. **## Architecture** - 3-5 bullet points describing the codebase shape (not a full directory tree)
3. **## Conventions** - max 8 key patterns. Move detailed rules to .claude/rules/conventions.md
4. **## Off-Limits** - max 8 guardrails specific to this project
5. **## Memory & Learnings** - ONLY if the project already has a ## Memory section or agentic-memory is configured in .claude/settings.json. If present, keep to max 6 bullets. If the project does NOT use memory, do NOT add this section
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

## Path-scoped rules generation

Scan the project structure and generate focused .claude/rules/ files with paths: frontmatter. These load ONLY when Claude works on matching files, saving context tokens.

**How to detect areas:**
1. List top-level directories under src/ (or equivalent). Each distinct area (api, components, lib, tests) is a candidate.
2. Check for monorepo indicators: workspaces in package.json, pnpm-workspace.yaml, nx.json, lerna.json. Each workspace is a candidate.
3. Check for docs/, tests/, scripts/ as separate scopes.

**For each detected area, create a rules file with this format:**

---
paths: ["src/api/**"]
---
# API Rules
- Validate all request input with zod schemas
- Return typed error responses, never throw raw errors
- Keep route handlers under 30 lines

**Stack-specific patterns to include:**
- Next.js app/: "Use Server Components by default, add 'use client' only when needed"
- API routes / src/api/: "Validate input at boundaries, typed error responses"
- React components: "Colocate components near usage, props interface above component"
- Tests: "One assertion per test when possible, descriptive test names"
- Database / prisma/ / drizzle/: "Never write raw SQL, use the ORM, migrations required"
- Docs: "No em dashes, max 3 sentences per paragraph, code examples required"

**When NOT to generate:**
- Small projects with < 5 source files (one conventions.md is enough)
- Projects where all code is in one flat directory
- If path-scoped rules already exist, don't overwrite them

**Monorepo handling:**
- Each package gets its own rules file: .claude/rules/packages-<name>.md
- Suggest claudeMdExcludes in settings.json to skip irrelevant package CLAUDE.md files

## Other advanced configuration

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
