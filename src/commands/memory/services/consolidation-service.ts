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
    return { deduplicated, episodicsCompressed };
  }

  /**
   * Phase 1: Deduplication via content similarity.
   */
  deduplicateMemories(): number {
    const memories = this.#deps.memoryRepo.getAll();
    // O(n): group by normalized content; exact duplicates are already blocked
    // at insert by the per-project unique content_hash — this pass only
    // catches whitespace/case variants.
    const byNormalized = new Map<string, typeof memories[number]>();
    let merged = 0;

    for (const memory of memories) {
      const key = `${memory.project ?? '_global'}\n${normalizeText(memory.content)}`;
      const keeper = byNormalized.get(key);
      if (!keeper) {
        byNormalized.set(key, memory);
        continue;
      }

      const [survivor, discard] = keeper.importance >= memory.importance
        ? [keeper, memory] : [memory, keeper];

      const mergedTags = [...new Set([...survivor.tags, ...discard.tags])];
      this.#deps.memoryRepo.updateContent(survivor.id, {
        tags: mergedTags,
        importance: Math.max(survivor.baseImportance, discard.baseImportance),
      });

      this.#deps.memoryRepo.hardDelete(discard.id);
      byNormalized.set(key, survivor);
      merged++;
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

}

// ── Helpers ──────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}
