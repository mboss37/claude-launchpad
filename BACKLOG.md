# Backlog — Parked Features

Features validated but deferred. Pick up when relevant.
Priority: P1 = big bug or must-have feature, P2 = real pain with clear evidence, P3 = nice-to-have / speculative / conditional.

---

## v1.10.0 Candidate: Rules Governance + Code Review (opinionated workflows)

- **[P2] Path-scoped rules with YAML frontmatter** — rules start with `--- paths: ["lib/security/**"] ---`, scope rule to file patterns. Cleaner than monolithic conventions.md. lp-enhance writes rules with `paths:`; doctor warns on rule files missing it.
- **[P3] Pre-commit-gate workflow + /lp-code-review skill** — `shasum` of staged diff → `.claude/state/last-review-<hash>`. PreToolUse on `git commit` blocks unless marker exists + tsc/lint/test pass. Code-reviewer agent writes marker only on approval. Ship as `init --strict` + new skill. Full sprint of its own.

---

## [P2] Story Tightening: Unify the Pitch Across Surfaces
Landing page leads with outcome ("credentials readable, rules 80%"), README with technical fact, CLI help with vague "measurably good", package.json lists 5 co-equal features. Memory gets 54 README lines vs doctor's 24 — optional drowning core. Fix: rewrite package.json description, lift landing outcome framing into README opener, sharpen CLI help, demote memory to "optional add-on".

## [P3] Eval: Precondition Check
`eval` runs scenarios even with no CLAUDE.md/settings. Reports "0 passed" with no hint. Add `parseClaudeConfig` check at start, fail-fast with "Run init first".

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
