# Claude Launchpad — Task Tracker

> Claude: Read this at session start. Keep this file SHORT — only current state matters.
> Rules: (1) Only show current + next sprint tasks. (2) Completed sprints get one summary line. (3) Session log: max 3 lines per session, keep only last 3 sessions. (4) Target: under 80 lines total.

## Completed Sprints
- **Sprints 0-35** (2025-11 → 2026-07): bash scaffolder → TS CLI → doctor/eval/memory → npm launch → security hardening → workflow discipline → enforcement layer → verification discipline. One line per sprint lives in git history (this file before 2026-07-08) and CHANGELOG.md.
- **Sprint 36**: Publish Gate (v1.13.0) — WP-036: regression suite silently tested a stale v1.10.1 PATH binary for two months (13/21 red locally, green in containers); now hard-pins repo dist + builds first, 21/21 local. WP-043: memory CLI honesty — non-TTY guard (exit 1), all sync failures throw, stats/doctor registered (doctor was built but unreachable), context --json emits real hookSpecificOutput envelope, npx-form hooks + doctor migration for shipped bare-form hooks, dead extract/search deleted. Review: 5 Important all fixed in-sprint (incl. no-op --fix flag, pull --all exit 0, own settings.json duplicate matcher). 578 tests (+10), 57 bench, self-score 100%.
- **Sprint 37**: Honest Memory Core (v1.14.0) — WP-044 decay purity (base_importance anchor, 10-runs==1 idempotency), WP-045 dead vector layer deleted (sqlite-vec gone: ONE native dep now; O(n) dedup; dead error/config code), WP-046 per-project content_hash + honest sync counts, WP-047 secret detection (real this time). Review caught 2 Critical: migration 007 would have bricked every existing install (vtab drop needs its module — now load-for-drop with safe fallback, proven by legacy-DB fixture tests) and sync re-imported compounding decay (payloads now carry base_importance). 4 Important also fixed (anchor erosion on edits, dedup scope, update validation bypass, greedy token regex). 591 tests, 57 bench, 21/21 regression.
- **Sprint 38**: Real Benchmark Gate (v1.14.0) — mutation testing proved retrieval/injection benches were decorative (passed with scoring gutted). Calibrated thresholds to measured baselines, matched-objective oracle, noise control-vs-inflated assertions, two weight-mutation discriminators, git-path score normalized ≤1.0 w/ golden-value test. 4-mutation panel documented + verified 4/4 red, healthy 59/59. Review: 2 Important fixed in-sprint (git-path had zero coverage; vacuous-pass guard).
- **Sprint 39**: Truthful Guards (v1.15.0) — WP-042 force-push ERE anchored+widened (19 behavioral tests; doctor migrates shipped projects), WP-052 publish hook gated on real success, WP-013 local-settings fixer gap, WP-039 agent-brief structure in Stop-and-Swarm, WP-040 Key Decisions why-log + 20-commit nudge. Review: 2 Important fixed in-sprint (rewriter emitted old pattern; ERE coverage regression). 619 tests (+27), 21/21 regression, self-score 100%.
- **Sprint 40**: Dashboard Find-Then-Act (v1.16.0) — WP-048: search→Enter keeps filter + returns keyboard to list, d=delete/X=purge (convention), relation titles not UUIDs, modal keyboard exclusivity, write-time index reconciliation, error boundary. First-ever dashboard interaction tests (ink-testing-library, 8 behaviors, bite-verified). Review: 2 Important fixed in-sprint. 627 tests (+8), 59 bench, 21/21 regression.

## Current Sprint
- [ ] WP-041 — minimumReleaseAge supply-chain guard
- [ ] WP-020 — Computed eval scenario counts
- [ ] WP-010 — async:true vs nohup (verify, then adopt or document)
- [ ] WP-011 — if: syntax in generated hooks (verify API, then adopt or document)
- [ ] WP-049 — Dashboard curation (undo, re-rate, tags, FTS, context)

## Release Plan
- **v1.16.0** ✅ shipped 2026-07-08 (npm latest + tag + GitHub release) — dashboard find-then-act. Earlier releases: CHANGELOG.md.
- **v2.0.0** not scheduled — reserved for a doctor plan/apply rewrite if ever committed to.
- Rule: a release line says only "shipped" or "ready"; verify against `npm view claude-launchpad dist-tags` before trusting this section. Publishing ends with flipping this line — a publish without that edit is unfinished.

## Session Log
### 2026-07-08 (session 49, day 2)
- Shipped THREE releases: v1.14.0 (honest memory core + security patch), v1.15.0 (truthful guards), v1.16.0 (dashboard find-then-act). Fixed the canary (never had a working credential — first green run ever), proved benchmarks alive by mutation (2 of 4 files were decorative), first dashboard interaction tests. Purged backlog to 6 community-value items; compressed this file. Next: decompose WP-051 (auto-capture first) when strategic energy exists.

### 2026-07-07 (session 49)
- Fable's last day: security patch 35→0 CVEs, Fable Mode v2 distilled into shipped verification discipline (Sprint 35), publish gate fixed (Sprint 36), 4-agent memory review → honest core (Sprints 37-38). Release-state SessionStart hook added — npm is the truth, files record intent.
