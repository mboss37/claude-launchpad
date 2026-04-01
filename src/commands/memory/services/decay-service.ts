import type { Memory, DecayParams } from '../types.js';
import type { MemoryRepo } from '../storage/memory-repo.js';
import type { RelationRepo } from '../storage/relation-repo.js';
import { DEFAULT_DECAY_PARAMS } from '../config.js';

// ── Types ────────────────────────────────────────────────────

export interface DecayServiceDeps {
  readonly memoryRepo: MemoryRepo;
  readonly relationRepo: RelationRepo;
  readonly params?: DecayParams;
}

export interface DecayReport {
  readonly decayed: number;
  readonly pruned: number;
  readonly workingCleared: number;
}

// ── Decay Service ────────────────────────────────────────────

export class DecayService {
  readonly #memoryRepo: MemoryRepo;
  readonly #relationRepo: RelationRepo;
  readonly #params: DecayParams;

  constructor(deps: DecayServiceDeps) {
    this.#memoryRepo = deps.memoryRepo;
    this.#relationRepo = deps.relationRepo;
    this.#params = deps.params ?? DEFAULT_DECAY_PARAMS;
  }

  /**
   * Run full decay cycle: clear working memories, apply decay, prune dead memories.
   */
  run(): DecayReport {
    const workingCleared = this.clearWorkingMemories();
    const decayed = this.decayAll();
    const pruned = this.prune();
    return { decayed, pruned, workingCleared };
  }

  clearWorkingMemories(): number {
    return this.#memoryRepo.deleteByType('working');
  }

  /**
   * Apply decay formula to all non-working memories.
   */
  decayAll(): number {
    const memories = this.#memoryRepo.getAll();
    let updated = 0;

    for (const memory of memories) {
      if (memory.type === 'working') continue;

      const newImportance = this.computeDecayedImportance(memory);
      if (Math.abs(newImportance - memory.importance) > 0.001) {
        this.#memoryRepo.updateImportanceOnly(memory.id, newImportance);
        updated++;
      }
    }

    return updated;
  }

  /**
   * Hard-delete memories below prune threshold.
   */
  prune(): number {
    const memories = this.#memoryRepo.getAll();
    const now = Date.now();
    let pruned = 0;

    for (const memory of memories) {
      if (memory.type === 'working') continue;

      const ageDays = (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (
        ageDays > this.#params.pruneMinAgeDays &&
        memory.importance < this.#params.pruneThreshold &&
        memory.accessCount === 0
      ) {
        this.#memoryRepo.hardDelete(memory.id);
        pruned++;
      }
    }

    return pruned;
  }

  /**
   * Compute decayed importance as a pure function of age from creation.
   * Uses createdAt (immutable) to avoid compounding decay across sessions.
   */
  computeDecayedImportance(memory: Memory): number {
    const tau = this.#params.tauByType[memory.type];
    if (tau === 0) return memory.importance;

    const ageDays = (Date.now() - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 0) return memory.importance;

    // Synaptic consolidation window (days 0-7)
    if (ageDays <= 7) {
      if (memory.type === 'episodic') {
        const ebbinghaus = Math.exp(-ageDays * 0.4);
        return Math.max(this.#params.importanceFloor, memory.importance * ebbinghaus);
      }
      return memory.importance;
    }

    // Access modifier: higher access count = larger tau = slower decay
    const accessModifier = this.getAccessModifier(memory.accessCount);

    // Relation modifier: connected memories decay slower
    const relationCount = this.#relationRepo.countByMemory(memory.id);
    const relationModifier = relationCount >= this.#params.relationModifier.connectedThreshold
      ? this.#params.relationModifier.connectedMultiplier
      : this.#params.relationModifier.isolatedMultiplier;

    let effectiveTau = tau * accessModifier * relationModifier;

    // Injection penalty: surfaced but never used = noise
    if (memory.injectionCount > 5 && memory.accessCount === 0) {
      effectiveTau /= 1.5;
    }

    const decayFactor = Math.exp(-(ageDays - 7) / effectiveTau);
    const newImportance = memory.importance * decayFactor;

    return Math.max(this.#params.importanceFloor, newImportance);
  }

  private getAccessModifier(accessCount: number): number {
    for (const tier of this.#params.accessModifiers) {
      if (accessCount <= tier.maxCount) return tier.multiplier;
    }
    return 1.0;
  }
}
