# claude-launchpad — Backlog

> **Single source of truth for future work.** Every work package (WP) that's been proposed but not yet started lives here.
>
> Rules (see `.claude/rules/workflow.md` for the full lifecycle):
> - Every WP uses the template below — no freeform entries.
> - WPs are **moved** to `TASKS.md` when pulled into a sprint, not copied. A WP lives in exactly one file at a time.
> - Priority ordering: **P0 > P1 > P2 > P3**. P0 items sit at the top.
> - A WP ID is minted when the WP is first added here and never reused.

---

## Priority definitions

| Priority | Meaning |
|---|---|
| **P0** | Blocks launch or an active sprint. Next sprint or sooner. |
| **P1** | Important for MVP. Pulled within 2–3 sprints. |
| **P2** | Post-MVP or nice-to-have. Review monthly. |
| **P3** | Parked idea. Review quarterly; delete if still untouched. |

---

## Work package template (copy this exactly)

```markdown
### WP-NNN — <short imperative title>

- **Priority:** P0 | P1 | P2 | P3
- **Proposed:** YYYY-MM-DD
- **Stories / Docs:** links to specs, issues, or "none yet"
- **Depends on:** WP-MMM (empty if none)
- **Estimate:** XS (<1h) | S (half-day) | M (1–2 days) | L (full sprint) | XL (>1 sprint; must decompose)
- **Trigger to pull:** What has to be true before this moves into a sprint.
- **Definition of done:** Exactly what "done" looks like.

One-paragraph description.
```

---

## P0 — Next sprint

<!-- Empty. -->

---

## P1 — Soon (within 2–3 sprints)

---

## P2 — Post-MVP / nice-to-have

---

---

### WP-053 — SEO content pages: hooks guide, comparisons, CLAUDE.md best practices

- **Priority:** P2
- **Proposed:** 2026-07-08
- **Stories / Docs:** SEO audit (session 49): "claude code hooks" has no target page despite being the core pitch; comparison queries (claude-mem alternative, mem0 vs) are high-intent/low-competition; doctor IS a CLAUDE.md linter but nothing targets that query.
- **Depends on:** none
- **Estimate:** M
- **Trigger to pull:** Next content/growth session.
- **Definition of done:** Three new docs pages, each targeting one query with a unique title/H1/description: (1) Claude Code hooks guide (anatomy, stdin contract, async, if:, our generated guards), (2) memory comparison page (honest table vs native/claude-mem/mem0 — zero-infra, free sync, measured retrieval), (3) CLAUDE.md best practices (budget, sections, what doctor checks). Cross-linked from home + relevant pages; added to sitemap.

---

## P3 — Parked

### WP-051 — Memory strategy arc: auto-capture, local embeddings, plugin distribution

- **Priority:** P3
- **Proposed:** 2026-07-07
- **Stories / Docs:** docs/reviews/2026-07-07-memory-review.md Cluster 4 (full competitive landscape + positioning)
- **Depends on:** WP-043, WP-044 (foundation must be honest first)
- **Estimate:** XL (must decompose before pulling)
- **Trigger to pull:** Decompose when the v1.14.0 quality sprint closes; each child is its own sprint.
- **Definition of done:** (of the decomposition) Five child WPs minted with the review's ranking: (1) auto-capture via SessionEnd/Stop hooks (extract.ts is the head start), (2) local-embedding hybrid retrieval (re-introduces sqlite-vec, wired), (3) Claude Code plugin marketplace packaging, (4) native-memory continuous interop + markdown export, (5) git-committed team memory. Positioning updated: "memory as managed, measurable infrastructure", not "Claude remembers".


---

## Launch Campaign (not WPs — marketing backlog)

- Landing page: before/after diff view (CLAUDE.md + settings.json)
- Record 10-sec terminal GIF (bad score → --fix → good score)
- PRs to awesome-claude-code lists
- Show HN post + Product Hunt launch

---

## Changelog

- **2026-07-08:** WP-053 minted (P2) from the docs SEO audit — three content pages targeting unowned high-intent queries.
- **2026-07-08:** Sprint 41 closed. WP-010, WP-011, WP-020, WP-041, WP-049 done (v1.17.0). Review: 1 Critical (no-op supply-chain guard) + 3 Important fixed in-sprint. Backlog now: WP-051 only.
- **2026-07-08:** WP-049, WP-020, WP-011, WP-010, WP-041 pulled into Sprint 41 (final polish sweep). WP-051 demoted P2→P3 per maintainer (strategy arc awaits deliberate commitment).
- **2026-07-08:** Backlog purged to community-value minimum: WP-001..009, 020(kept), 021, 022 reviewed; 11 items deleted (no demand since May / superseded by WP-051 / internal-only). 5 items remain.
- **2026-07-01:** WP-015..WP-019 minted from external project review (3.5/5 → path to 5/5). P0: WP-015 (stop stripping the sandbox — scope it), WP-016 (canary CI against latest real Claude Code). P1: WP-017 (eval custom/transcript/judge checks), WP-018 (intent-based checks replace template heuristics), WP-019 (cross-machine sync becomes the flagship memory story — repositioning, not spin-off, per maintainer feedback).
- **2026-07-01:** WP-015, WP-016, WP-017, WP-018, WP-019 pulled into Sprint 33 (the 5/5 arc, single combined sprint). Sequencing note removed with the pull.
- **2026-07-01:** Sprint 33 closed. WP-015, WP-016, WP-017, WP-018, WP-019 done (v1.11.0). Code review: 2 Critical + 5 Important fixed in-sprint; 3 Minor findings filed as WP-020..WP-022 (P3).
- **2026-07-02:** WP-023..WP-035 minted from the template-workflow review (11-agent panel: 3 readers, 3 ecosystem researchers, 5 judges) and pulled into Sprint 34 in the same edit, plus WP-014 pulled from P1. Theme: the enforcement layer must stop being decorative — warnings reach the model, phantom PostCompact replaced, dead/false-positive triggers fixed, review gate delegates to native /code-review, Stop-and-Swarm modernized, dangling references resolved, jq preflight, superpowers detect-and-recommend, reviewer subagent, dependency-aware pulls, batch invariants into doctor.
- **2026-07-02:** Sprint 34 closed. WP-014, WP-023..WP-035 done (v1.12.0). Review: 1 Critical (PostCompact exists — side-effect-only; fixer gated) + 2 Important (stale-hook migration path, Sprint 32 nudge rewrite) fixed in-sprint.
- **2026-07-07:** WP-036 (P1, regression suite red on dev machine), WP-039 (P1, sub-agent briefs in Stop-and-Swarm), WP-040 (P1, Key Decisions why-log), WP-042 (P1, force-push hook false positive), WP-041 (P2, minimumReleaseAge guard) minted from session 49 (Fable Mode v2 gap analysis + security patch fallout). WP-037, WP-038 minted as P0 and pulled into Sprint 35 in the same edit (verification discipline arc: generated verification rule + doctor check/fixer + premature-victory eval scenario); scope + DoD live in the sprint plan.
- **2026-07-07:** Sprint 35 closed. WP-037, WP-038 done (v1.13.0). Review: 0 Critical, 2 Important (dead scenario `runs` field now honored; landing-page scenario count) fixed in-sprint.
- **2026-07-07:** WP-036, WP-043 pulled into Sprint 36 (v1.13.0 publish gate).
- **2026-07-07:** WP-044..WP-047 pulled into Sprint 37 (v1.14.0 honest-memory core) and completed same session.
- **2026-07-08:** WP-050 pulled into Sprint 38 (make the benchmark gate real or cut it).
- **2026-07-08:** Sprint 40 closed. WP-048 done (v1.16.0). Review: 2 Important fixed in-sprint (modal guard, index reconciliation).
- **2026-07-08:** WP-048 pulled into Sprint 40 (dashboard find-then-act).
- **…2026-05-04:** earlier entries compressed — full history in git.
