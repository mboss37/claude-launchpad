import type { Memory, MemoryType, SearchResult, SearchInput, RelationType } from '../types.js';
import type { MemoryRepo } from '../storage/memory-repo.js';
import type { RelationRepo } from '../storage/relation-repo.js';
import type { SearchRepo } from '../storage/search-repo.js';
import { SCORING_WEIGHTS } from '../config.js';
import { type GitContext, getGitContext, computeContextScore } from '../utils/git-context.js';

const STALENESS_THRESHOLDS = {
  working: 1,
  episodic: 7,
  pattern: 14,
  semantic: 30,
  procedural: 90,
} as const;

export interface RetrievalDeps {
  readonly memoryRepo: MemoryRepo;
  readonly relationRepo: RelationRepo;
  readonly searchRepo: SearchRepo;
  readonly gitContext?: GitContext;
}

export class RetrievalService {
  readonly #deps: RetrievalDeps;
  readonly #gitContext: GitContext;

  constructor(deps: RetrievalDeps) {
    this.#deps = deps;
    this.#gitContext = deps.gitContext ?? getGitContext();
  }

  /**
   * FTS5 keyword search with multi-signal scoring, context awareness,
   * and relation-based graph expansion.
   */
  async search(input: SearchInput): Promise<readonly SearchResult[]> {
    // Direct ID lookup
    if (input.id) {
      const memory = this.#deps.memoryRepo.getById(input.id);
      if (!memory) return [];
      this.#deps.memoryRepo.incrementAccess(input.id);
      return [{
        memory,
        score: 1.0,
        explanation: 'Direct lookup by ID',
      }];
    }

    // Phase 1: FTS5 keyword search
    const ftsResults = this.#deps.searchRepo.searchFts({
      query: input.query,
      limit: input.limit * 3,
      type: input.type,
      minImportance: input.min_importance,
      project: input.project,
    });

    const textScores = ftsOnlyScores(ftsResults);
    if (textScores.size === 0) return [];

    // Phase 2: Load memories and compute composite scores
    const candidates: { memory: Memory; composite: number; parts: ScoreParts }[] = [];

    for (const [memoryId, textScore] of textScores) {
      const memory = this.#deps.memoryRepo.getById(memoryId);
      if (!memory) continue;
      if (input.type && memory.type !== input.type) continue;
      if (memory.importance < input.min_importance) continue;
      if (input.tags?.length) {
        const memTags = new Set(memory.tags);
        if (!input.tags.every(t => memTags.has(t))) continue;
      }

      const parts = computeScoreParts(memory, textScore, this.#gitContext, input.query);
      const composite = computeComposite(parts);
      candidates.push({ memory, composite, parts });
    }

    // Phase 3: Sort by composite score
    candidates.sort((a, b) => b.composite - a.composite);
    let topN = candidates.slice(0, input.limit);

    // Phase 4: Relation expansion — surface connected memories
    const seenIds = new Set(topN.map(c => c.memory.id));
    const expanded = this.#expandWithRelations(topN, input.limit, seenIds, input.min_importance, input.type);
    if (expanded.length > 0) {
      topN = [...topN, ...expanded].sort((a, b) => b.composite - a.composite).slice(0, input.limit);
    }

    // Phase 5: Build results with explanations, increment access
    return topN.map(({ memory, composite, parts }) => {
      this.#deps.memoryRepo.incrementAccess(memory.id);
      return {
        memory,
        score: composite,
        explanation: parts.relationSource
          ? `Related (${parts.relationSource.type}) to: ${parts.relationSource.title ?? parts.relationSource.id}`
          : buildExplanation(parts, memory),
      };
    });
  }

  /**
   * Smart session loading: returns context-matched, recent, and related memories
   * for session start context injection.
   */
  loadSessionContext(input: {
    readonly limit: number;
    readonly project?: string;
    readonly type?: MemoryType;
  }): readonly SessionContextResult[] {
    const contextBudget = Math.floor(input.limit * 0.4);
    const recentBudget = Math.floor(input.limit * 0.4);
    const relatedBudget = input.limit - contextBudget - recentBudget;
    const seenIds = new Set<string>();

    const contextMatched = this.#loadContextMatched(contextBudget, input.project, input.type, seenIds);
    const recent = this.#loadRecent(recentBudget, input.project, input.type, seenIds);

    const sourceIds = [...contextMatched, ...recent].map(r => r.result.memory.id);
    const related = this.#loadRelatedExpansion(sourceIds, relatedBudget, seenIds, input.type);

    const all = [...contextMatched, ...recent, ...related];
    for (const entry of all) {
      this.#deps.memoryRepo.incrementInjection(entry.result.memory.id);
    }
    return all;
  }

  #loadContextMatched(
    budget: number, project?: string, type?: MemoryType, seenIds?: Set<string>,
  ): SessionContextResult[] {
    if (budget <= 0) return [];
    const candidates = this.#deps.memoryRepo.getRecent(budget * 5, project, type);
    const scored: { memory: Memory; ctxScore: number; composite: number }[] = [];

    for (const m of candidates) {
      const ctxScore = computeContextScore(m.context, this.#gitContext, '');
      if (ctxScore <= 0.1) continue;
      const composite = ctxScore * 0.5 + m.importance * 0.3 + computeRecencyScore(m.updatedAt) * 0.2;
      scored.push({ memory: m, ctxScore, composite });
    }

    scored.sort((a, b) => b.composite - a.composite);
    const results: SessionContextResult[] = [];
    for (const s of scored.slice(0, budget)) {
      seenIds?.add(s.memory.id);
      results.push({ section: 'context', result: { memory: s.memory, score: s.composite, explanation: 'Context match' } });
    }
    return results;
  }

  #loadRecent(
    budget: number, project?: string, type?: MemoryType, seenIds?: Set<string>,
  ): SessionContextResult[] {
    if (budget <= 0) return [];
    const candidates = this.#deps.memoryRepo.getRecent(budget * 2, project, type);
    const results: SessionContextResult[] = [];

    for (const m of candidates) {
      if (seenIds?.has(m.id)) continue;
      const score = m.importance * 0.4 + computeRecencyScore(m.updatedAt) * 0.6;
      seenIds?.add(m.id);
      results.push({ section: 'recent', result: { memory: m, score, explanation: 'Recent' } });
      if (results.length >= budget) break;
    }
    return results;
  }

  #loadRelatedExpansion(
    sourceIds: readonly string[], budget: number, seenIds: Set<string>, typeFilter?: MemoryType,
  ): SessionContextResult[] {
    if (budget <= 0) return [];
    const results: SessionContextResult[] = [];

    for (const srcId of sourceIds) {
      const relations = this.#deps.relationRepo.getByMemory(srcId);
      for (const rel of relations) {
        const otherId = rel.sourceId === srcId ? rel.targetId : rel.sourceId;
        if (otherId === srcId || seenIds.has(otherId)) continue;

        const other = this.#deps.memoryRepo.getById(otherId);
        if (!other) continue;
        if (typeFilter && other.type !== typeFilter) continue;

        const src = this.#deps.memoryRepo.getById(srcId);
        const weight = RELATION_TYPE_WEIGHTS[rel.relationType] ?? 0.5;
        seenIds.add(otherId);
        results.push({
          section: 'related',
          result: {
            memory: other,
            score: other.importance * weight,
            explanation: `Related (${rel.relationType}) to: ${src?.title ?? srcId}`,
          },
        });
        if (results.length >= budget) return results;
      }
    }
    return results;
  }

  #expandWithRelations(
    topResults: readonly { memory: Memory; composite: number; parts: ScoreParts }[],
    limit: number,
    seenIds: Set<string>,
    minImportance: number,
    typeFilter?: MemoryType,
  ): { memory: Memory; composite: number; parts: ScoreParts }[] {
    if (topResults.length >= limit) return [];

    const expanded: { memory: Memory; composite: number; parts: ScoreParts }[] = [];
    const remaining = limit - topResults.length;
    const sourcesToExpand = topResults.slice(0, 5);

    for (const parent of sourcesToExpand) {
      const relations = this.#deps.relationRepo.getByMemory(parent.memory.id);
      for (const rel of relations) {
        const otherId = rel.sourceId === parent.memory.id ? rel.targetId : rel.sourceId;
        if (otherId === parent.memory.id || seenIds.has(otherId)) continue;

        const other = this.#deps.memoryRepo.getById(otherId);
        if (!other || other.importance < minImportance) continue;
        if (typeFilter && other.type !== typeFilter) continue;

        const weight = RELATION_TYPE_WEIGHTS[rel.relationType] ?? 0.5;
        const composite = parent.composite * 0.7 * weight;
        const parts: ScoreParts = {
          textScore: 0,
          importanceScore: other.importance,
          recencyScore: computeRecencyScore(other.updatedAt),
          accessScore: computeAccessScore(other.accessCount, other.lastAccessed),
          contextScore: 0,
          relationSource: { id: parent.memory.id, title: parent.memory.title, type: rel.relationType },
        };

        seenIds.add(otherId);
        expanded.push({ memory: other, composite, parts });
        if (expanded.length >= remaining) return expanded;
      }
    }

    return expanded;
  }
}

// ── Relation Expansion ──────────────────────────────────────

const RELATION_TYPE_WEIGHTS: Record<RelationType, number> = {
  depends_on: 1.0,
  extends: 0.9,
  implements: 0.9,
  relates_to: 0.7,
  derived_from: 0.6,
  contradicts: 0.3,
};

// ── FTS5-Only Fallback ───────────────────────────────────────

function ftsOnlyScores(ftsResults: readonly { memoryId: string; rank: number }[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const r of ftsResults) {
    const score = Math.min(1, -r.rank / 20);
    scores.set(r.memoryId, score);
  }
  return scores;
}

// ── Scoring ───────────────────────────────────────────────────

interface ScoreParts {
  readonly textScore: number;
  readonly importanceScore: number;
  readonly recencyScore: number;
  readonly accessScore: number;
  readonly contextScore: number;
  readonly relationSource?: { readonly id: string; readonly title: string | null; readonly type: RelationType };
}

function computeScoreParts(
  memory: Memory,
  textScore: number,
  gitContext: GitContext,
  query: string,
): ScoreParts {
  return {
    textScore,
    importanceScore: memory.importance,
    recencyScore: computeRecencyScore(memory.updatedAt),
    accessScore: computeAccessScore(memory.accessCount, memory.lastAccessed),
    contextScore: computeContextScore(memory.context, gitContext, query),
  };
}

function computeComposite(parts: ScoreParts): number {
  return (
    parts.textScore * SCORING_WEIGHTS.text +
    parts.importanceScore * SCORING_WEIGHTS.importance +
    parts.recencyScore * SCORING_WEIGHTS.recency +
    parts.accessScore * SCORING_WEIGHTS.access +
    parts.contextScore * SCORING_WEIGHTS.context
  );
}

/**
 * Recency score: 1.0 for today, decays exponentially.
 * Uses a 30-day half-life.
 */
function computeRecencyScore(updatedAt: string): number {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays < 0) return 1.0;
  return Math.exp(-ageDays * Math.LN2 / 30);
}

/**
 * Access score: logarithmic count x recency of last access.
 */
function computeAccessScore(accessCount: number, lastAccessed: string | null): number {
  if (accessCount <= 0) return 0;
  const countScore = Math.min(1.0, Math.log10(accessCount + 1) / Math.log10(31));
  if (!lastAccessed) return countScore * 0.5;
  const ageDays = (Date.now() - new Date(lastAccessed).getTime()) / 86_400_000;
  const recency = Math.exp(-ageDays * Math.LN2 / 30);
  return countScore * (0.5 + 0.5 * recency);
}

// ── Explanation ───────────────────────────────────────────────

function buildExplanation(parts: ScoreParts, memory: Memory): string {
  const factors: string[] = [];

  if (parts.textScore > 0.7) {
    factors.push(`High text match (${(parts.textScore * 100).toFixed(0)}%)`);
  } else if (parts.textScore > 0.3) {
    factors.push(`Moderate text match (${(parts.textScore * 100).toFixed(0)}%)`);
  }

  if (memory.importance > 0.7) {
    factors.push('High importance');
  }

  if (parts.recencyScore > 0.8) {
    factors.push('Very recent');
  } else if (parts.recencyScore > 0.5) {
    factors.push('Recent');
  }

  if (memory.accessCount > 10) {
    factors.push(`Frequently accessed (${memory.accessCount}x)`);
  } else if (memory.accessCount > 3) {
    factors.push(`Accessed ${memory.accessCount}x`);
  }

  if (parts.contextScore > 0.3) {
    factors.push('Context match');
  }

  const ageDays = Math.floor((Date.now() - new Date(memory.createdAt).getTime()) / 86_400_000);
  const stalenessThreshold = STALENESS_THRESHOLDS[memory.type];
  if (stalenessThreshold !== undefined && ageDays > stalenessThreshold) {
    factors.push(`${ageDays}d old - verify before acting`);
  }

  return factors.length > 0 ? factors.join(' + ') : 'Matched query';
}

// ── Types ────────────────────────────────────────────────────

export interface SessionContextResult {
  readonly section: 'context' | 'recent' | 'related';
  readonly result: SearchResult;
}

// Exported for testing
export { computeRecencyScore, computeAccessScore, computeComposite, computeScoreParts, ftsOnlyScores };
export type { ScoreParts };
