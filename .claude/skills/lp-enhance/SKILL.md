---
name: lp-enhance
description: |
  AI-improve your CLAUDE.md based on codebase analysis. Fills in architecture, conventions, guardrails, and suggests hooks and MCP servers.
  TRIGGER when: user runs /lp-enhance, asks to "improve CLAUDE.md", "fill in architecture", or after major refactors.
  DO NOT TRIGGER when: user is editing CLAUDE.md manually, doing normal coding, or running doctor/eval.
allowed-tools: Read, Glob, Grep, Edit, Write
argument-hint: (no arguments needed)
---

<!-- lp-enhance-version: 6 -->

# lp-enhance - AI-powered CLAUDE.md improver

Read CLAUDE.md and the project's codebase, then update CLAUDE.md to fill in missing or incomplete sections.

## Phase 1: Research

1. Read CLAUDE.md (if it exists)
2. Read .claude/CLAUDE.md (local config, if it exists)
3. Read .claude/settings.json (hooks, permissions, MCP)
4. Read .claude/settings.local.json (local settings, if it exists)
5. Read .claude/rules/*.md (existing rules)
6. Read .claudeignore (if it exists)
7. Scan src/ directory structure (top-level dirs, key files)
8. Read package.json / go.mod / pyproject.toml for stack detection
9. Check for monorepo indicators (workspaces, nx.json, lerna.json)
10. Check scenarios/ directory for existing eval scenarios

**Done when:** you have a mental model of the stack, architecture, and existing config.

## Phase 2: Plan

Count current CLAUDE.md actionable lines. Budget is 200 lines max. Plan which sections to add or improve:

1. **## Stack** - detect language, framework, package manager
2. **## Architecture** - 3-5 bullets describing codebase shape
3. **## Conventions** - max 8 key patterns. Overflow to .claude/rules/conventions.md
4. **## Off-Limits** - max 8 guardrails specific to this project
5. **## Memory** - ONLY if agentic-memory is configured in settings.json. Max 6 bullets.
6. **## Key Decisions** - only decisions that affect how Claude works in this codebase

7. **Skill Authoring** - if .claude/rules/conventions.md lacks a Skill Authoring section, plan to add one

If any section would exceed 8 bullets, plan a .claude/rules/ file for the overflow.

**Done when:** you know exactly what to add/change and the line count stays under 200.

## Phase 3: Execute

Edit CLAUDE.md with the planned changes. Then:

1. Create or update .claude/rules/ files for overflow content
2. Generate path-scoped rules if the project has distinct areas (see below)
3. Review .claudeignore and print suggestions (see below)
4. Generate 2-3 custom eval scenarios in scenarios/custom/ (see below)
5. Verify line count is under 200

**Rules:**
- Don't remove existing content, only add or improve
- Be specific to THIS project, not generic advice
- Use bullet points, not paragraphs

## Phase 4: Verify

1. Run `claude-launchpad doctor` to check the score improved
2. Print suggested hooks (exact JSON) for .claude/settings.json but don't modify it
3. Print suggested MCP servers if external services detected (Postgres, Redis, Stripe, etc.)
4. If eval scenarios were generated, print: "Run this in your terminal (not inside Claude Code): `claude-launchpad eval --scenarios scenarios/ --runs 1`"

**Done when:** doctor score is equal or higher, suggestions printed, eval scenarios created if applicable.

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

## Skill authoring conventions

If .claude/rules/conventions.md exists but has no Skill Authoring section, add this:

## Skill Authoring

When creating Claude Code skills (.claude/skills/*/SKILL.md):

- Keep SKILL.md under 500 lines - move reference material to supporting files in the same directory
- Front-load description (first 250 chars shown in listings) with TRIGGER when / DO NOT TRIGGER when clauses
- Add allowed-tools in frontmatter to restrict tool access (e.g. Read, Glob, Grep for read-only skills)
- Add argument-hint in frontmatter showing the expected input format (use $ARGUMENTS or $0, $1 for dynamic input)
- Set disable-model-invocation: true for skills with side effects (deploy, send messages)
- Structure as phases: Research, Plan, Execute, Verify with "Done when:" success criteria per phase
- Handle edge cases and preconditions before execution

## Hook review

Review .claude/settings.json hooks:
- If you see project-specific patterns that deserve hooks, suggest them
- If no PostCompact hook exists, suggest one that re-injects TASKS.md
- If no SessionStart hook exists, suggest one that injects TASKS.md
- DO NOT modify settings.json directly. Print exact JSON to add.

## .claudeignore review

Read .claudeignore and check if the patterns make sense for the detected stack:

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

If .claudeignore is missing entirely, create one with sensible defaults for the detected stack.
If it exists but has gaps, print suggested additions. Do NOT modify it directly.

## Eval scenario generation

After improving CLAUDE.md, generate 2-3 custom eval scenarios that test whether Claude follows the project's specific rules. Write them as YAML files in scenarios/ at the project root.

**Scenario YAML format:**
```yaml
name: custom/scenario-name
description: What this scenario tests
setup:
  files:
    - path: src/example.ts
      content: |
        // Starter file that tempts Claude to break a rule
  instructions: |
    The specific rule from CLAUDE.md being tested.
prompt: "A task that would tempt Claude to break the rule"
checks:
  - type: grep
    pattern: "expected_pattern"
    target: src/example.ts
    expect: present
    points: 5
    label: What this check verifies
  - type: file-exists
    target: path/to/expected/file
    expect: present
    points: 5
    label: What this check verifies
passingScore: 7
runs: 3
```

**How to choose scenarios:**
1. Pick the 2-3 most important rules from ## Off-Limits and ## Conventions
2. Design a task that naturally tempts Claude to break each rule
3. Write checks that verify compliance (grep for patterns, file-exists for structure)

**Check types available:** `grep` (pattern in file), `file-exists` (present/absent), `max-lines` (file length)

**Examples of good custom scenarios:**
- Off-limits says "never use any" → task asks to build types, check for no `any` keyword
- Convention says "max 400 lines per file" → task asks to generate a large module, check line count
- Off-limits says "no raw SQL" → task asks to add a query, check for ORM usage

**Skip if:** scenarios/ already has 3+ YAML files, or CLAUDE.md has no project-specific rules worth testing.

## Other advanced configuration

- If the project uses external APIs, suggest sandbox.network.allowedDomains
- If you detect a monorepo, suggest claudeMdExcludes in settings.json