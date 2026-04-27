# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P1 = big bug or must-have feature, P2 = real pain with clear evidence, P3 = nice-to-have / speculative / conditional.

---

## v1.9.0 Sprint Candidate: Hackathon Hooks
Battle-tested in `semantic-gps-hackathon` over 5 days (100+ marker runs in `.claude/state/`). All five generic, fit existing TASKS.md/BACKLOG.md philosophy, close real holes.

- **[P1] Extract `lib/hook-builder.ts`** — hook-patching duplicated 3 ways (install.ts addSessionStart/End/Pull, fixer.ts 12 hook-adding fns, fixer-memory.ts placement variants). Single `addOrUpdateHook(settings, placement, event, matcher, dedup, prepend?)`. Hard prereq for the 4 new hooks below.
- **[P1] `.worktreeinclude` template + doctor check** — 2-line file (`.env.local`, `.env`) lets git-worktree subagents inherit secrets without committing them. Without it, worktree subagents fail tests silently. Init generates; doctor warns when worktrees used + file missing/empty.
- **[P1] Sprint hygiene hooks** — `sprint-size-check.sh` warns on <3 (microsprint) or >7 (oversized) `## Current:` work packages. `sprint-open-check.sh` warns when TASKS.md adds new sprint block but BACKLOG.md has no staged deletions. Both warn-don't-block, pure bash, init-generated.
- **[P1] PostToolUse sprint-complete nudge** — when TASKS.md edited and current-sprint checkboxes all flip to `[x]`, hook prints "Sprint complete, run /wrap-sprint." One-liner hook, big UX.
- **[P1] PreToolUse `.env` Read/Write/Edit block** — current `permissions.deny` only blocks Read; Write/Edit can still nuke `.env`. Match path on R/W/E, exit 1, allow `.env.example` through.

---

## v1.10.0 Candidate: Rules Governance + Code Review (opinionated workflows)

- **[P2] Path-scoped rules with YAML frontmatter** — rules start with `--- paths: ["lib/security/**"] ---`, scope rule to file patterns. Cleaner than monolithic conventions.md. lp-enhance writes rules with `paths:`; doctor warns on rule files missing it.
- **[P3] Pre-commit-gate workflow + /lp-code-review skill** — `shasum` of staged diff → `.claude/state/last-review-<hash>`. PreToolUse on `git commit` blocks unless marker exists + tsc/lint/test pass. Code-reviewer agent writes marker only on approval. Ship as `init --strict` + new skill. Full sprint of its own.

---

## [P2] Story Tightening: Unify the Pitch Across Surfaces
Landing page leads with outcome ("credentials readable, rules 80%"), README with technical fact, CLI help with vague "measurably good", package.json lists 5 co-equal features. Memory gets 54 README lines vs doctor's 24 — optional drowning core. Fix: rewrite package.json description, lift landing outcome framing into README opener, sharpen CLI help, demote memory to "optional add-on".

## [P3] Eval: Precondition Check
`eval` runs scenarios even with no CLAUDE.md/settings. Reports "0 passed" with no hint. Add `parseClaudeConfig` check at start, fail-fast with "Run init first".

## [P3] Code: Split fixer.ts
426 lines, 48 FIX_TABLE entries + inline impls. Move to `fixers/{hooks,quality,rules,permissions}.ts`. Pairs well with hook-builder.ts extraction in v1.9.0.

## [P3] Code: watcher.ts Type Cast + Dead Backlog Generator
`watcher.ts:53` uses `as unknown as { parentPath?: string }` for Node readdir. Also verify `init/generators/backlog.ts::generateBacklogMd` is called; delete if dead.

## [P3] Memory: Auto-Relation Discovery
Search related memories at store time, auto-create relations. Sprint 26 oracle at 71.7% is healthy — revisit only if injection quality regresses.

## [P3] Memory: lp-migrate-memory Local Placement + New-Project Skip
Local scope skips skill creation (skill goes to committed `.claude/skills/`); should install to `~/.claude/skills/`. Also skip skill on projects with no legacy `~/.claude/projects/*/memory/` files.

## [P3] Memory: Auto-Title Untitled Memories at Store Time
Auto-derive title from first ~40 chars when `memory_store` called without one. Root-cause fix for "(untitled)" in dashboard/injection.

## [P3] Doctor: Plan/Apply Architecture (v2.0.0 breaking)
Replace direct-write `--fix` with Terraform-style plan/apply. Sprint 25 LP-STUB markers already address most of this. 32-36h, breaking release.

## [P3] Kill: Doctor --watch Mode
Nobody watches their Claude config for changes. Remove or hide behind undocumented flag.

## [P3] Docs: .mdx Extension Middleware
Fumadocs middleware for `/docs/foo.mdx`. Blocked by GitHub Pages static export. Revisit on Vercel migration.

## Launch Campaign
- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch
