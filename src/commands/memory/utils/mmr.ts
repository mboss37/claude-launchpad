import type { Memory } from "../types.js";
import { extractKeywords, jaccardOverlap } from "./similarity.js";

// ── MMR (Maximal Marginal Relevance) ───────────────────────────
// Carbonell & Goldstein (1998). Re-ranks a relevance-sorted list
// by penalizing candidates too similar to already-selected items.
// Same relevance budget, more topic coverage per slot.
//
//   MMR(c) = λ · Rel(c) − (1 − λ) · max_{s ∈ S} Sim(c, s)
//
// λ=1 preserves pure relevance order. λ=0 maximizes diversity.

export interface MMRScored {
  readonly memory: Memory;
  readonly score: number;
}

export interface MMROptions {
  readonly lambda: number;
  readonly maxRerank: number;
  readonly contentWeight: number;
  readonly tagsWeight: number;
}

interface Features {
  readonly content: ReadonlySet<string>;
  readonly tags: ReadonlySet<string>;
}

function featuresOf(memory: Memory): Features {
  return {
    content: extractKeywords(memory.content),
    tags: new Set(memory.tags),
  };
}

function blendedSimilarity(
  a: Features,
  b: Features,
  contentWeight: number,
  tagsWeight: number,
): number {
  return (
    jaccardOverlap(a.content, b.content) * contentWeight
    + jaccardOverlap(a.tags, b.tags) * tagsWeight
  );
}

export function applyMMR<T extends MMRScored>(
  scored: readonly T[],
  options: MMROptions,
): readonly T[] {
  if (scored.length <= 1) return scored;

  const { lambda, maxRerank, contentWeight, tagsWeight } = options;
  const rerankCount = Math.min(scored.length, maxRerank);
  const pool = scored.slice(0, rerankCount);
  const tail = scored.slice(rerankCount);

  const features = new Map<string, Features>();
  for (const s of pool) {
    features.set(s.memory.id, featuresOf(s.memory));
  }

  const remaining = new Set(pool.map((s) => s.memory.id));
  const selected: T[] = [];

  while (remaining.size > 0) {
    let best: T | null = null;
    let bestMMR = -Infinity;

    for (const candidate of pool) {
      if (!remaining.has(candidate.memory.id)) continue;

      const candFeat = features.get(candidate.memory.id);
      if (!candFeat) continue;

      let maxSim = 0;
      for (const picked of selected) {
        const pickedFeat = features.get(picked.memory.id);
        if (!pickedFeat) continue;
        const sim = blendedSimilarity(candFeat, pickedFeat, contentWeight, tagsWeight);
        if (sim > maxSim) maxSim = sim;
      }

      const mmr = lambda * candidate.score - (1 - lambda) * maxSim;
      if (mmr > bestMMR) {
        bestMMR = mmr;
        best = candidate;
      }
    }

    if (!best) break;
    selected.push(best);
    remaining.delete(best.memory.id);
  }

  return [...selected, ...tail];
}
