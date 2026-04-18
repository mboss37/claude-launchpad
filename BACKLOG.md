# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P1 = soon, P2 = when relevant, P3 = if circumstances change.

---

## [P1] Memory: Auto-Relation Discovery
When storing a new memory, search for related existing memories and auto-create relations (relates_to, extends, contradicts). More connections improve injection scoring and decay resistance.

## [P1] Memory: lp-migrate-memory Skill for Local Placement
Local scope memory install skips skill creation (skills go to `.claude/skills/` which is committed). Should install to `~/.claude/skills/` (global scope) instead.

## [P1] Memory: Skip lp-migrate-memory for New Projects
Install should check `~/.claude/projects/*/memory/` for files matching the current project slug. No legacy files = skip installing the migration skill.

## [P1] Memory: Show Content Preview for Untitled Memories
Dashboard and context injection show "(untitled)" for memories stored without a title. Show first ~30 chars of content instead.

## [P2] Doctor: Plan/Apply Architecture (v2.0.0 breaking)
Replace `doctor --fix` direct-write with Terraform-style plan/apply. Every change rendered as a diff before writing. ChangeRecord refactor (~40 FIX_TABLE entries → `Promise<ChangeRecord[]>`), interactive renderer, resumable apply state, hash revalidation with CRLF/BOM normalization, legacy `--fix` deprecated. Ship only if users complain about static fixes mangling mature CLAUDE.md files after Sprint 25 lands. Sprint-scale: 32-36h, breaking release.

## [P3] Kill: Doctor --watch Mode
Nobody watches their Claude config for changes. Consider removing or hiding behind an undocumented flag.

## [P3] Docs: .mdx Extension Middleware
Fumadocs supports middleware that rewrites `/docs/foo.mdx` to the per-page markdown route, letting AI agents append `.mdx` to any doc URL. Not possible on GitHub Pages (static export). Revisit if we switch to Vercel hosting.

## Launch Campaign
- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch
