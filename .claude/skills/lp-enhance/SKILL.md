---
name: lp-enhance
description: |
  AI-improve your CLAUDE.md based on codebase analysis. Fills in architecture, conventions, guardrails, and suggests hooks and MCP servers.
  TRIGGER when: user runs /lp-enhance, asks to "improve CLAUDE.md", "fill in architecture", or after major refactors.
  DO NOT TRIGGER when: user is editing CLAUDE.md manually, doing normal coding, or running doctor/eval.
allowed-tools: Read, Glob, Grep, Edit, Write
argument-hint: (no arguments needed)
---

# lp-enhance - AI-powered CLAUDE.md improver

Read CLAUDE.md and the project's codebase, then update CLAUDE.md to fill in missing or incomplete sections.

## Phase 1: Research

1. Read CLAUDE.md (if it exists)
2. Read .claude/settings.json (hooks, permissions, MCP)
3. Read .claude/rules/*.md (existing rules)
4. Scan src/ directory structure (top-level dirs, key files)
5. Read package.json / go.mod / pyproject.toml for stack detection
6. Check for monorepo indicators (workspaces, nx.json, lerna.json)

**Done when:** you have a mental model of the stack, architecture, and existing config.

## Phase 2: Plan

Count current CLAUDE.md actionable lines. Budget is 200 lines max. Plan which sections to add or improve:

1. **## Stack** - detect language, framework, package manager
2. **## Architecture** - 3-5 bullets describing codebase shape
3. **## Conventions** - max 8 key patterns. Overflow to .claude/rules/conventions.md
4. **## Off-Limits** - max 8 guardrails specific to this project
5. **## Memory** - ONLY if agentic-memory is configured in settings.json. Max 6 bullets.
6. **## Key Decisions** - only decisions that affect how Claude works in this codebase

If any section would exceed 8 bullets, plan a .claude/rules/ file for the overflow.

**Done when:** you know exactly what to add/change and the line count stays under 200.

## Phase 3: Execute

Edit CLAUDE.md with the planned changes. Then:

1. Create or update .claude/rules/ files for overflow content
2. Generate path-scoped rules if the project has distinct areas (see below)
3. Verify line count is under 200

**Rules:**
- Don't remove existing content, only add or improve
- Be specific to THIS project, not generic advice
- Use bullet points, not paragraphs

## Phase 4: Verify

1. Run `claude-launchpad doctor` to check the score improved
2. Print suggested hooks (exact JSON) for .claude/settings.json but don't modify it
3. Print suggested MCP servers if external services detected (Postgres, Redis, Stripe, etc.)

**Done when:** doctor score is equal or higher, suggestions printed.

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

## Hook review

Review .claude/settings.json hooks:
- If you see project-specific patterns that deserve hooks, suggest them
- If no PostCompact hook exists, suggest one that re-injects TASKS.md
- If no SessionStart hook exists, suggest one that injects TASKS.md
- DO NOT modify settings.json directly. Print exact JSON to add.

## Other advanced configuration

- If the project uses external APIs, suggest sandbox.network.allowedDomains
- If you detect a monorepo, suggest claudeMdExcludes in settings.json
