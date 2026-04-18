# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P1 = big bug or must-have feature, P2 = real pain with clear evidence, P3 = nice-to-have / speculative / conditional.

---

## [P3] Memory: Auto-Relation Discovery
When storing a new memory, search for related existing memories and auto-create relations (relates_to, extends, contradicts). Speculative — no user complaint, Sprint 26 benchmark already at 71.7% oracle. Revisit if injection quality regresses.

## [P3] Memory: lp-migrate-memory Skill for Local Placement
Local scope memory install skips skill creation (skills go to `.claude/skills/` which is committed). Should install to `~/.claude/skills/` instead. Edge case on sunset feature — intersection of "has legacy `~/.claude/projects/*/memory/` files" AND "installs in local scope" is near-zero users.

## [P3] Memory: Skip lp-migrate-memory for New Projects
Install should check `~/.claude/projects/*/memory/` for files matching the current project slug. No legacy files = skip installing the migration skill. Cosmetic (extra file that does nothing).

## [P3] Memory: Auto-Title Untitled Memories at Store Time
When `memory_store` is called without a title, auto-derive one from the first ~40 chars of content (or require title in the tool schema). Root-cause fix for "(untitled)" entries in dashboard and injection — band-aid display fix would paper over an LLM behavior problem.

## [P3] Doctor: Plan/Apply Architecture (v2.0.0 breaking)
Replace `doctor --fix` direct-write with Terraform-style plan/apply. Every change rendered as a diff before writing. ChangeRecord refactor (~40 FIX_TABLE entries → `Promise<ChangeRecord[]>`), interactive renderer, resumable apply state, hash revalidation with CRLF/BOM normalization, legacy `--fix` deprecated. Ship only if users complain about static fixes mangling mature CLAUDE.md files. Sprint 25 LP-STUB markers already address the "mangling" concern. Sprint-scale: 32-36h, breaking release.

## [P3] Kill: Doctor --watch Mode
Nobody watches their Claude config for changes. Consider removing or hiding behind an undocumented flag.

## [P3] Docs: .mdx Extension Middleware
Fumadocs supports middleware that rewrites `/docs/foo.mdx` to the per-page markdown route, letting AI agents append `.mdx` to any doc URL. Not possible on GitHub Pages (static export). Revisit if we switch to Vercel hosting.

## Launch Campaign
- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch
