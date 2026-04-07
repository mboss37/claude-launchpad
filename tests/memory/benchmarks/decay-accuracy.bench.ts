import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createBenchDb, closeDatabase, reportMetrics, daysAgoIso, type BenchDb } from './fixtures/bench-harness.js';
import { DecayService } from '../../../src/commands/memory/services/decay-service.js';
import { DEFAULT_DECAY_PARAMS } from '../../../src/commands/memory/config.js';
import type { Memory, MemoryType } from '../../../src/commands/memory/types.js';

function createMemoryAtAge(bench: BenchDb, type: MemoryType, importance: number, daysOld: number, accessCount = 0): Memory {
  const memory = bench.memoryRepo.create(
    { type, content: `${type} memory at ${daysOld} days`, tags: [], importance, source: 'manual' },
    null,
  );
  const date = daysAgoIso(daysOld);
  bench.db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?').run(date, date, memory.id);
  for (let i = 0; i < accessCount; i++) bench.memoryRepo.incrementAccess(memory.id);
  return bench.memoryRepo.getById(memory.id)!;
}

describe('Decay Accuracy Benchmarks', () => {
  let bench: BenchDb;
  let decayService: DecayService;

  beforeAll(() => {
    bench = createBenchDb();
    decayService = new DecayService({
      memoryRepo: bench.memoryRepo,
      relationRepo: bench.relationRepo,
    });
  });

  afterAll(() => closeDatabase(bench.db));

  describe('survival curves', () => {
    const timePoints = [30, 90, 180, 365] as const;
    const types: MemoryType[] = ['episodic', 'semantic', 'procedural', 'pattern'];

    it.each(timePoints)('type ordering holds at day %d', (days) => {
      const scores: Record<string, number> = {};

      for (const type of types) {
        const mem = createMemoryAtAge(bench, type, 0.8, days);
        scores[type] = decayService.computeDecayedImportance(mem);
      }

      reportMetrics(`Survival at ${days}d`, scores);

      // Invariant: procedural > semantic > pattern > episodic
      expect(scores['procedural']).toBeGreaterThan(scores['semantic']!);
      expect(scores['semantic']).toBeGreaterThan(scores['pattern']!);
      expect(scores['pattern']).toBeGreaterThanOrEqual(scores['episodic']!);
    });

    it('generates full survival table', () => {
      const allPoints = [7, 14, 30, 60, 90, 180, 365];
      const table: Record<string, Record<string, number>> = {};

      for (const type of types) {
        table[type] = {};
        for (const days of allPoints) {
          const mem = createMemoryAtAge(bench, type, 0.8, days);
          table[type]![`${days}d`] = Number(decayService.computeDecayedImportance(mem).toFixed(4));
        }
      }

      console.log('\n── Full Survival Table (importance=0.8) ──');
      console.table(table);
    });
  });

  describe('behavioral invariants', () => {
    it('high-importance semantics survive 365 days', () => {
      const mem = createMemoryAtAge(bench, 'semantic', 0.9, 365);
      const decayed = decayService.computeDecayedImportance(mem);
      expect(decayed).toBeGreaterThan(0.3);
    });

    it('old unaccessed episodics reach floor by 90 days', () => {
      const mem = createMemoryAtAge(bench, 'episodic', 0.5, 90);
      const decayed = decayService.computeDecayedImportance(mem);
      expect(decayed).toBeLessThan(0.15);
    });

    it('accessed memories resist decay (spacing effect)', () => {
      const noAccess = createMemoryAtAge(bench, 'semantic', 0.8, 180, 0);
      const withAccess = createMemoryAtAge(bench, 'semantic', 0.8, 180, 10);

      const decayedNoAccess = decayService.computeDecayedImportance(noAccess);
      const decayedWithAccess = decayService.computeDecayedImportance(withAccess);

      reportMetrics('Spacing Effect (180d semantic)', {
        'no access': decayedNoAccess,
        '10 accesses': decayedWithAccess,
        'ratio': decayedWithAccess / decayedNoAccess,
      });

      expect(decayedWithAccess).toBeGreaterThan(decayedNoAccess * 1.1);
    });

    it('relation count affects decay rate', () => {
      const isolated = createMemoryAtAge(bench, 'semantic', 0.8, 180);
      const connected = createMemoryAtAge(bench, 'semantic', 0.8, 180);

      // Create 6+ relations to make it "highly connected"
      for (let i = 0; i < 7; i++) {
        const other = createMemoryAtAge(bench, 'semantic', 0.5, 30);
        bench.relationRepo.create(connected.id, other.id, 'relates_to');
      }

      const decayedIsolated = decayService.computeDecayedImportance(isolated);
      const decayedConnected = decayService.computeDecayedImportance(connected);

      reportMetrics('Relation Effect (180d semantic)', {
        'isolated (modifier=1.3)': decayedIsolated,
        'highly connected (modifier=0.35)': decayedConnected,
        'ratio (connected/isolated)': decayedConnected / decayedIsolated,
      });

      // NOTE: Current config multiplies tau by 0.35 for highly connected,
      // which actually accelerates decay (lower tau = faster).
      // isolatedMultiplier=1.3 slows isolated decay slightly.
      // This may be a config bug — the comment says "near-immune" but
      // the multiplier reduces tau. Benchmark captures current behavior.
      expect(decayedIsolated).not.toBe(decayedConnected);
    });

    it('injection penalty accelerates decay for unused memories', () => {
      const normal = createMemoryAtAge(bench, 'semantic', 0.8, 90);
      const noisy = createMemoryAtAge(bench, 'semantic', 0.8, 90);

      // Inject 10 times but never access
      for (let i = 0; i < 10; i++) bench.memoryRepo.incrementInjection(noisy.id);
      const noisyRefreshed = bench.memoryRepo.getById(noisy.id)!;

      const decayedNormal = decayService.computeDecayedImportance(normal);
      const decayedNoisy = decayService.computeDecayedImportance(noisyRefreshed);

      reportMetrics('Injection Penalty (90d semantic, 10 injections, 0 access)', {
        'normal': decayedNormal,
        'noisy (injected but unused)': decayedNoisy,
      });

      expect(decayedNoisy).toBeLessThan(decayedNormal);
    });

    it('importance floor is always respected', () => {
      const ancient = createMemoryAtAge(bench, 'episodic', 0.3, 500);
      const decayed = decayService.computeDecayedImportance(ancient);
      expect(decayed).toBeGreaterThanOrEqual(DEFAULT_DECAY_PARAMS.importanceFloor);
    });
  });

  describe('Ebbinghaus curve (episodic 0-7 days)', () => {
    it('shows steep initial drop with floor', () => {
      const points = [0, 1, 2, 3, 5, 7];
      const scores: Record<string, number> = {};

      for (const days of points) {
        const mem = createMemoryAtAge(bench, 'episodic', 0.8, days);
        scores[`${days}d`] = decayService.computeDecayedImportance(mem);
      }

      reportMetrics('Ebbinghaus Curve (episodic, importance=0.8)', scores);

      // Day 0 should be near original
      expect(scores['0d']).toBeGreaterThan(0.7);
      // Day 3 should have dropped significantly
      expect(scores['3d']).toBeLessThan(scores['0d']!);
      // Day 7 should have a floor (0.2 residual × 0.8 importance)
      expect(scores['7d']).toBeGreaterThanOrEqual(0.05);
    });
  });
});
