import type { MemoryRepo } from '../storage/memory-repo.js';
import type { RelationRepo } from '../storage/relation-repo.js';

// ── Types ────────────────────────────────────────────────────

export interface ConsolidationDeps {
  readonly memoryRepo: MemoryRepo;
  readonly relationRepo: RelationRepo;
}

export interface ConsolidationReport {
  readonly deduplicated: number;
  readonly episodicsCompressed: number;
  readonly pruned: number;
}

// ── Consolidation Service ────────────────────────────────────

export class ConsolidationService {
  readonly #deps: ConsolidationDeps;

  constructor(deps: ConsolidationDeps) {
    this.#deps = deps;
  }

  /**
   * Run consolidation pipeline.
   * Phase 1: Deduplicate exact/near-exact content matches
   * Phase 2: Compress old consolidated episodics
   * Phase 3: Prune dead memories
   */
  async consolidate(): Promise<ConsolidationReport> {
    const deduplicated = this.deduplicateMemories();
    const episodicsCompressed = this.compressEpisodics();
    const pruned = this.prune();
    return { deduplicated, episodicsCompressed, pruned };
  }

  /**
   * Phase 1: Deduplication via content similarity.
   */
  deduplicateMemories(): number {
    const memories = this.#deps.memoryRepo.getAll();
    const seen = new Set<string>();
    let merged = 0;

    for (const memory of memories) {
      if (seen.has(memory.id)) continue;

      const normalizedContent = normalizeText(memory.content);

      for (const other of memories) {
        if (other.id === memory.id) continue;
        if (seen.has(other.id)) continue;

        const otherNormalized = normalizeText(other.content);
        if (normalizedContent !== otherNormalized) continue;

        const [keeper, discard] = memory.importance >= other.importance
          ? [memory, other] : [other, memory];

        const mergedTags = [...new Set([...keeper.tags, ...discard.tags])];
        this.#deps.memoryRepo.updateContent(keeper.id, {
          tags: mergedTags,
          importance: Math.max(keeper.importance, discard.importance),
        });

        this.#deps.memoryRepo.hardDelete(discard.id);
        seen.add(discard.id);
        merged++;

        if (discard.id === memory.id) break;
      }

      seen.add(memory.id);
    }

    return merged;
  }

  /**
   * Phase 2: Compress old episodic memories that have been consolidated.
   */
  compressEpisodics(): number {
    const episodics = this.#deps.memoryRepo.getByType('episodic');
    const now = Date.now();
    let compressed = 0;

    for (const memory of episodics) {
      const ageDays = (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays <= 60) continue;
      if (memory.accessCount > 0) continue;
      if (memory.importance >= 0.2) continue;

      const relations = this.#deps.relationRepo.getBySource(memory.id);
      const isConsolidated = relations.some(r => r.relationType === 'derived_from');
      if (!isConsolidated) continue;

      this.#deps.memoryRepo.hardDelete(memory.id);
      compressed++;
    }

    return compressed;
  }

  /**
   * Phase 3: Prune dead memories.
   */
  prune(): number {
    const memories = this.#deps.memoryRepo.getAll();
    const now = Date.now();
    let pruned = 0;

    for (const memory of memories) {
      if (memory.type === 'working') continue;
      const ageDays = (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 90 && memory.importance < 0.1 && memory.accessCount === 0) {
        this.#deps.memoryRepo.hardDelete(memory.id);
        pruned++;
      }
    }

    return pruned;
  }
}

// ── Helpers ──────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}
