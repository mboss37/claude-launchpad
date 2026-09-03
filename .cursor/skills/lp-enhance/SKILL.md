---
name: lp-enhance
description: |
  AI-improve your AGENTS.md based on codebase analysis. Fills in architecture, conventions, guardrails, and suggests path-scoped rules and MCP servers.
  TRIGGER when: user runs /lp-enhance, asks to "improve AGENTS.md", "fill in architecture", or after major refactors.
  DO NOT TRIGGER when: user is editing AGENTS.md manually, doing normal coding, or running doctor.
---

<!-- lp-cursor-enhance-version: 1 -->

# lp-enhance - AI-powered AGENTS.md improver

Read AGENTS.md and the project's codebase, then update AGENTS.md to fill in missing or incomplete sections.

## Phase 1: Research

1. Read AGENTS.md (if it exists)
2. Read .cursor/rules/*.mdc (existing rules and their frontmatter)
3. Read .cursor/hooks.json and the scripts it references under .cursor/hooks/
4. Read .cursor/mcp.json (configured MCP servers, if any)
5. Read .cursorignore (if it exists)
6. Scan src/ directory structure (top-level dirs, key files)
7. Read package.json / go.mod / pyproject.toml for stack detection
8. Check for monorepo indicators (workspaces, pnpm-workspace.yaml, nx.json, lerna.json)

**Done when:** you have a mental model of the stack, architecture, and existing config.

## Phase 2: Plan

Count current AGENTS.md actionable lines. Budget is 200 lines max. Plan which sections to add or improve:

1. **## Stack** - detect language, framework, package manager
2. **## Architecture** - 3-5 bullets describing codebase shape
3. **## Conventions** - max 8 key patterns. Overflow to .cursor/rules/conventions.mdc
4. **## Off-Limits** - max 8 guardrails specific to this project
5. **## Key Decisions** - only decisions that affect how the agent works in this codebase

If any section would exceed 8 bullets, plan a .cursor/rules/ file for the overflow.

**Done when:** you know exactly what to add/change and the line count stays under 200.

## Phase 3: Execute

Edit AGENTS.md with the planned changes. Then:

1. Create or update .cursor/rules/ files for overflow content
2. Generate path-scoped rules if the project has distinct areas (see below)
3. Review .cursorignore and print suggestions (see below)
4. Verify line count is under 200

**Rules:**
- Don't remove existing content, only add or improve
- Be specific to THIS project, not generic advice
- Use bullet points, not paragraphs

## Phase 4: Verify

1. Run `claude-launchpad doctor --harness cursor` to check the score improved
2. Print suggested hooks (exact JSON) for .cursor/hooks.json but don't modify it
3. Print suggested MCP servers for .cursor/mcp.json if external services detected (Postgres, Redis, Stripe, etc.)

**Done when:** doctor score is equal or higher and suggestions are printed.

## Path-scoped rules generation

Scan the project structure and generate focused .cursor/rules/*.mdc files with globs frontmatter. These load ONLY when the agent works on matching files, saving context tokens.

**How to detect areas:**
1. List top-level directories under src/ (or equivalent). Each distinct area (api, components, lib, tests) is a candidate.
2. Check for monorepo indicators: workspaces in package.json, pnpm-workspace.yaml, nx.json, lerna.json. Each workspace is a candidate.
3. Check for docs/, tests/, scripts/ as separate scopes.

**For each detected area, create an .mdc rules file with this format:**

---
description: API rules
globs: "src/api/**"
alwaysApply: false
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
- Small projects with < 5 source files (one conventions.mdc is enough)
- Projects where all code is in one flat directory
- If path-scoped rules already exist, don't overwrite them

**Monorepo handling:**
- Each package gets its own rules file: .cursor/rules/packages-<name>.mdc with globs scoped to that package

## Hook review

Review .cursor/hooks.json:
- If you see project-specific patterns that deserve hooks, suggest them
- Security hooks (env-read, destructive-shell) should stay failClosed: true
- If no sessionStart hook injects TASKS.md, suggest one
- DO NOT modify hooks.json directly. Print exact JSON to add.

## .cursorignore review

Read .cursorignore and check if the patterns make sense for the detected stack:

**Always flag:**
- Missing node_modules/ (JS/TS projects)
- Missing __pycache__/ or .venv/ (Python projects)
- Missing target/ (Rust/Java projects)
- Missing .env / .env.* patterns
- Missing lock files (pnpm-lock.yaml, package-lock.json, yarn.lock, etc.)
- Missing coverage/ directory
- Large generated files that waste context (*.min.js, *.map, migrations/)

**Never flag:**
- Patterns the user clearly added intentionally
- Test fixtures or seed data (might be needed for context)

If .cursorignore is missing entirely, create one with sensible defaults for the detected stack.
If it exists but has gaps, print suggested additions. Do NOT modify it directly.