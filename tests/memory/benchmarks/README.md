# Memory Benchmarks

57+ tests measuring retrieval quality, injection quality, decay accuracy, and scale
performance. Run with `pnpm bench:memory`. **Mandatory before releasing any memory
change** (see CLAUDE.md).

## Thresholds are calibrated, not aspirational

Every aggregate threshold sits just below a measured baseline (recorded in the
assertion comments with its date). If you intentionally change an algorithm and a
threshold moves, re-measure the baseline, update the threshold AND the comment, and
document why in the commit message. Never widen a threshold to make a red test green.

## The mutation panel (run after any benchmark or scoring change)

A benchmark suite that cannot fail is a green lamp, not a gate. Prove the suite is
alive by breaking each algorithm and confirming red (verified 4/4 on 2026-07-08):

| # | Mutation | Expected |
|---|---|---|
| 1 | `config.ts` decay tau: `procedural: 730` → `5` | decay-accuracy fails (type ordering) |
| 2 | `config.ts` `INJECTION_MMR_LAMBDA = 0.7` → `1.0` | diversity-selection fails (coverage) |
| 3 | `config.ts` `SCORING_WEIGHTS.text: 0.35` → `0.0` | retrieval-quality fails (R@5, MRR, scoring discipline) |
| 4 | `config.ts` `INJECTION_WEIGHTS` context/value/importance → `0`, recency → `0.9` | injection-quality fails (scoring discipline) |

Apply one at a time, run `pnpm bench:memory`, confirm failures, revert
(`git checkout -- src/commands/memory/config.ts`). If any mutation passes green,
the suite has gone decorative again — fix the benchmark before shipping anything.

## What each file guards

- **retrieval-quality**: IR metrics (P@5/P@10/R@5/R@10/MRR) over 30 labeled queries,
  relation expansion, type filtering, and a text-dominance discriminator (at equal
  importance, strong text match must beat a fresher weak match).
- **injection-quality**: budget utilization, tier distribution, pinning, a
  matched-objective knapsack oracle (validates *packing*, not weights — greedy with
  tiering beats the full-cost-only optimum), a noise-penalty control-vs-inflated
  comparison, and a weights discriminator (month-old high-importance memories must
  outscore fresh trivia).
- **decay-accuracy**: behavioral invariants — tau ordering by type, Ebbinghaus window,
  access/relation/noise modifiers, importance floor.
- **diversity-selection**: MMR topic coverage vs a no-MMR baseline under crowding.
- **scale-performance**: p95 latency budgets at 1k/5k/10k memories. Wall-clock —
  known to be sensitive to slow shared CI hardware (Sprint 33 note).
