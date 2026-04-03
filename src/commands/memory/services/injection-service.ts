import type { MemoryRepo } from "../storage/memory-repo.js";
import type { RelationRepo } from "../storage/relation-repo.js";
import type { Memory } from "../types.js";
import {
  estimateTokens,
  INJECTION_WEIGHTS as W,
  TYPE_INJECTION_BONUS,
  RECENCY_HALF_LIFE,
  INJECTION_MIN_SCORE,
  INJECTION_COLD_START_THRESHOLD,
  INJECTION_HEADER_TOKENS,
} from "../config.js";
import { computeContextScore, type GitContext } from "../utils/git-context.js";

// ── Types ──────────────────────────────────────────────────────

export type InjectionTier = "full" | "summary" | "index";

export interface ScoredMemory {
  readonly memory: Memory;
  readonly score: number;
  readonly tier: InjectionTier;
  readonly tokenCost: number;
}

export interface InjectionResult {
  readonly memories: readonly ScoredMemory[];
  readonly tokensUsed: number;
  readonly tokenBudget: number;
  readonly totalCount: number;
}

interface InjectionDeps {
  readonly memoryRepo: MemoryRepo;
  readonly relationRepo: RelationRepo;
  readonly gitContext?: GitContext;
}

// ── Service ────────────────────────────────────────────────────

export class InjectionService {
  readonly #deps: InjectionDeps;

  constructor(deps: InjectionDeps) {
    this.#deps = deps;
  }

  selectForInjection(tokenBudget: number, project?: string): InjectionResult {
    const allMemories = this.#deps.memoryRepo.getAll(project);
    const totalCount = allMemories.length;

    // Gate: skip working memories and below-floor importance
    const candidates = allMemories.filter(
      (m) => m.type !== "working" && m.importance >= 0.05,
    );

    if (candidates.length === 0) {
      return { memories: [], tokensUsed: 0, tokenBudget, totalCount };
    }

    // Cold start: inject all if few memories
    const minScore = candidates.length <= INJECTION_COLD_START_THRESHOLD
      ? 0.10
      : INJECTION_MIN_SCORE;

    // Score all candidates
    const scored = candidates
      .map((m) => ({ memory: m, score: this.#scoreMemory(m) }))
      .filter((s) => s.score >= minScore)
      .sort((a, b) => b.score - a.score);

    // Greedy token-budget packing with tier assignment
    return this.#packBudget(scored, tokenBudget, totalCount);
  }

  formatInjection(result: InjectionResult): string {
    const { memories, tokensUsed, tokenBudget, totalCount } = result;

    if (memories.length === 0) {
      return "No memories stored for this project. Use memory_store to save knowledge across sessions.";
    }

    const lines: string[] = [];
    lines.push(`# Agentic Memory (${memories.length} of ${totalCount} memories, ${tokensUsed}/${tokenBudget} tokens)`);
    lines.push("Use memory_search to retrieve full content for any memory listed here.\n");

    const full = memories.filter((m) => m.tier === "full");
    const summary = memories.filter((m) => m.tier === "summary");
    const index = memories.filter((m) => m.tier === "index");

    if (full.length > 0) {
      lines.push("## Key Memories");
      for (const { memory: m } of full) {
        lines.push(`### ${m.title ?? "(untitled)"} [${m.type}]`);
        lines.push(m.content.slice(0, 500));
        if (m.tags.length > 0) lines.push(`Tags: ${m.tags.join(", ")}`);
        lines.push("");
      }
    }

    if (summary.length > 0) {
      lines.push("## Related Memories");
      for (const { memory: m } of summary) {
        const snippet = m.content.slice(0, 150);
        const ellipsis = m.content.length > 150 ? "..." : "";
        lines.push(`- **${m.title ?? "(untitled)"}** [${m.type}]: ${snippet}${ellipsis}`);
      }
      lines.push("");
    }

    if (index.length > 0) {
      lines.push("## Also Available (use memory_search)");
      for (const { memory: m } of index) {
        lines.push(`- ${m.id.slice(0, 8)} ${m.title ?? "(untitled)"} [${m.type}]`);
      }
    }

    return lines.join("\n");
  }

  // ── Scoring ────────────────────────────────────────────────

  #scoreMemory(memory: Memory): number {
    const ctx = this.#contextRelevance(memory);
    const val = this.#valueSignal(memory);
    const imp = memory.importance;
    const rec = this.#recencyScore(memory);
    const typ = TYPE_INJECTION_BONUS[memory.type] ?? 0.5;
    const noise = this.#noisePenalty(memory);

    return (
      ctx * W.context +
      val * W.value +
      imp * W.importance +
      rec * W.recency +
      typ * W.typeBonus +
      noise * W.noise
    );
  }

  #contextRelevance(memory: Memory): number {
    if (!this.#deps.gitContext) return 0;
    return computeContextScore(memory.context, this.#deps.gitContext, "");
  }

  #valueSignal(memory: Memory): number {
    const { accessCount, injectionCount } = memory;

    // Never injected or accessed: neutral — give it a chance
    if (accessCount === 0 && injectionCount === 0) return 0.5;

    // Injected but never accessed: noise
    if (injectionCount > 0 && accessCount === 0) {
      return Math.max(0.0, 0.5 - Math.min(1.0, injectionCount / 10) * 0.5);
    }

    // Access-to-injection ratio
    const ratio = Math.min(1.0, accessCount / Math.max(1, injectionCount));
    return 0.4 + ratio * 0.6;
  }

  #recencyScore(memory: Memory): number {
    const halfLife = RECENCY_HALF_LIFE[memory.type] ?? 30;
    const ageDays = (Date.now() - new Date(memory.updatedAt).getTime()) / 86_400_000;
    return Math.exp(-ageDays * Math.LN2 / halfLife);
  }

  #noisePenalty(memory: Memory): number {
    if (memory.injectionCount <= 3) return 1.0; // no penalty for first 3
    if (memory.accessCount > 0) return 1.0;     // any access = useful
    return Math.max(0.2, 1.0 - Math.log2(memory.injectionCount - 2) * 0.15);
  }

  // ── Token Budget Packing ───────────────────────────────────

  #packBudget(
    scored: readonly { readonly memory: Memory; readonly score: number }[],
    tokenBudget: number,
    totalCount: number,
  ): InjectionResult {
    const available = tokenBudget - INJECTION_HEADER_TOKENS;
    const selected: ScoredMemory[] = [];
    let tokensUsed = INJECTION_HEADER_TOKENS;

    for (const { memory, score } of scored) {
      if (tokensUsed >= tokenBudget) break;

      const tier = this.#assignTier(score, selected.length, available - (tokensUsed - INJECTION_HEADER_TOKENS));
      const cost = this.#estimateTierTokens(memory, tier);

      if (tokensUsed + cost <= tokenBudget) {
        selected.push({ memory, score, tier, tokenCost: cost });
        tokensUsed += cost;
        continue;
      }

      // Try cheaper tier
      const demoted = tier === "full" ? "summary" as const : tier === "summary" ? "index" as const : null;
      if (demoted) {
        const demotedCost = this.#estimateTierTokens(memory, demoted);
        if (tokensUsed + demotedCost <= tokenBudget) {
          selected.push({ memory, score, tier: demoted, tokenCost: demotedCost });
          tokensUsed += demotedCost;
        }
      }
    }

    // Track injections
    for (const entry of selected) {
      this.#deps.memoryRepo.incrementInjection(entry.memory.id);
    }

    return { memories: selected, tokensUsed, tokenBudget, totalCount };
  }

  #assignTier(score: number, position: number, remainingBudget: number): InjectionTier {
    if (position < 3 && score >= 0.60 && remainingBudget > 200) return "full";
    if (position < 8 && score >= 0.35 && remainingBudget > 80) return "summary";
    return "index";
  }

  #estimateTierTokens(memory: Memory, tier: InjectionTier): number {
    const meta = `[${memory.type}] ${memory.title ?? ""} (${memory.tags.join(", ")})`;
    switch (tier) {
      case "full":
        return estimateTokens(memory.content.slice(0, 500)) + estimateTokens(meta) + 10;
      case "summary":
        return estimateTokens(memory.content.slice(0, 150)) + estimateTokens(meta) + 8;
      case "index":
        return estimateTokens(`${memory.id.slice(0, 8)} [${memory.type}] ${memory.title ?? "(untitled)"}`) + 4;
    }
  }
}
