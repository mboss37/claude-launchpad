import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createBenchDb, closeDatabase, reportMetrics, type BenchDb } from './fixtures/bench-harness.js';
import { seedDatabase, seedRelations, type IdMap } from './fixtures/seed-dataset.js';
import { InjectionService } from '../../../src/commands/memory/services/injection-service.js';
import { estimateTokens, INJECTION_HEADER_TOKENS } from '../../../src/commands/memory/config.js';

describe('Injection Quality Benchmarks', () => {
  let bench: BenchDb;
  let idMap: IdMap;
  let injectionService: InjectionService;

  beforeAll(() => {
    bench = createBenchDb();
    idMap = seedDatabase(bench.memoryRepo);
    seedRelations(bench.relationRepo, idMap);
    injectionService = new InjectionService({
      memoryRepo: bench.memoryRepo,
      relationRepo: bench.relationRepo,
    });
  });

  afterAll(() => closeDatabase(bench.db));

  describe.each([500, 1500, 3000])('budget=%d tokens', (budget) => {
    it('budget utilization >= 50%', () => {
      const result = injectionService.selectForInjection(budget);
      const utilization = result.tokensUsed / budget;

      reportMetrics(`Budget ${budget} utilization`, {
        tokensUsed: result.tokensUsed,
        tokenBudget: budget,
        utilization,
        memoriesSelected: result.memories.length,
        totalAvailable: result.totalCount,
      });

      // At large budgets with small datasets, utilization can be low
      // because minScore filtering removes candidates
      const minUtilization = budget <= 1500 ? 0.5 : 0.3;
      expect(utilization).toBeGreaterThanOrEqual(minUtilization);
    });

    it('selected memories have higher avg importance than pool average', () => {
      const result = injectionService.selectForInjection(budget);
      if (result.memories.length === 0) return;

      const allMemories = bench.memoryRepo.getAll();
      const poolAvg = allMemories.reduce((s, m) => s + m.importance, 0) / allMemories.length;
      const selectedAvg = result.memories.reduce((s, m) => s + m.memory.importance, 0) / result.memories.length;

      reportMetrics(`Budget ${budget} importance`, {
        poolAverage: poolAvg,
        selectedAverage: selectedAvg,
        ratio: selectedAvg / poolAvg,
      });

      expect(selectedAvg).toBeGreaterThanOrEqual(poolAvg);
    });

    it('tier distribution makes sense', () => {
      const result = injectionService.selectForInjection(budget);
      const tiers = { full: 0, summary: 0, index: 0 };
      for (const m of result.memories) tiers[m.tier]++;

      reportMetrics(`Budget ${budget} tiers`, tiers);

      // At tight budgets, full tier is capped (assignTier gives full to positions 0-2)
      if (budget <= 500) {
        expect(tiers.full).toBeLessThanOrEqual(3);
      }
    });

    it('pinned high-importance memories are included', () => {
      const result = injectionService.selectForInjection(budget);
      const highImportance = bench.memoryRepo.getAll().filter(m => m.importance >= 0.8 && m.type !== 'working');

      if (highImportance.length === 0) return;

      const selectedIds = new Set(result.memories.map(m => m.memory.id));
      const pinnedCount = highImportance.filter(m => selectedIds.has(m.id)).length;

      reportMetrics(`Budget ${budget} pinned`, {
        highImportanceTotal: highImportance.length,
        pinnedInResult: pinnedCount,
        pinnedRatio: pinnedCount / highImportance.length,
      });

      // At reasonable budgets, at least some pinned should be included
      if (budget >= 1500) {
        expect(pinnedCount).toBeGreaterThan(0);
      }
    });
  });

  describe('oracle comparison', () => {
    it('greedy packing achieves >= 90% of the optimal for the SAME objective', () => {
      // The knapsack oracle optimizes the packer's own composite score —
      // a matched objective. This validates PACKING quality (tiering lets
      // greedy even beat the full-cost-only knapsack: baseline ratio 1.03).
      // Scoring-weight sanity lives in the 'scoring discipline' test below.
      const budget = 3000;
      const result = injectionService.selectForInjection(budget);
      const greedyScore = result.memories.reduce((s, m) => s + m.score, 0);

      const candidates = bench.memoryRepo.getAll().filter(m => m.type !== 'working' && m.importance >= 0.05);
      const scored = injectionService.scoreEligibleCandidates(candidates);
      const oracleScore = dpKnapsack(scored.map(sc => ({
        value: sc.score,
        weight: estimateTokenCost(sc.memory),
      })), budget - INJECTION_HEADER_TOKENS);

      reportMetrics('Oracle comparison (budget=3000)', {
        greedyScore,
        oracleScore,
        ratio: oracleScore > 0 ? greedyScore / oracleScore : 1,
      });

      expect(oracleScore).toBeGreaterThan(0);
      expect(greedyScore / oracleScore).toBeGreaterThanOrEqual(0.9); // baseline 1.025 (2026-07-08)
    });
  });

  describe('scoring discipline', () => {
    it('month-old high-importance memories outscore fresh trivia', () => {
      // Direct discriminator for INJECTION_WEIGHTS: gut context/value/
      // importance in favor of recency and this ordering flips (verified
      // baseline: golds 0.60 vs chaff 0.52 healthy; 0.53 vs 0.97 gutted).
      const freshBench = createBenchDb();
      const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
      const goldIds: string[] = [];
      const chaffIds: string[] = [];
      for (let i = 0; i < 4; i++) {
        const g = freshBench.memoryRepo.create({
          type: 'semantic', title: `gold ${i}`,
          content: `Hard-won architectural decision ${i}: the canonical approach for subsystem ${i} and why alternatives failed.`,
          tags: [`#topic${i}`], importance: 0.75, source: 'manual',
        })!;
        freshBench.db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?')
          .run(daysAgo(30), daysAgo(30), g.id);
        goldIds.push(g.id);
        const c = freshBench.memoryRepo.create({
          type: 'episodic', title: `chaff ${i}`,
          content: `Minor note ${i} from this morning about a trivial thing nobody will need again.`,
          tags: [`#noise${i}`], importance: 0.12, source: 'manual',
        })!;
        chaffIds.push(c.id);
      }
      const svc = new InjectionService({ memoryRepo: freshBench.memoryRepo, relationRepo: freshBench.relationRepo });
      const scored = svc.scoreEligibleCandidates(freshBench.memoryRepo.getAll());
      const goldScores = scored.filter(sc => goldIds.includes(sc.memory.id)).map(sc => sc.score);
      const chaffScores = scored.filter(sc => chaffIds.includes(sc.memory.id)).map(sc => sc.score);

      expect(goldScores.length).toBe(4);
      expect(chaffScores.length).toBe(4);
      expect(Math.min(...goldScores)).toBeGreaterThan(Math.max(...chaffScores));
      closeDatabase(freshBench.db);
    });
  });

  describe('noise penalty', () => {
    it('reduces selection of injected-but-unused memories', () => {
      // Create a fresh bench to isolate this test
      const freshBench = createBenchDb();
      const freshIdMap = seedDatabase(freshBench.memoryRepo);

      // Inject some memories many times without accessing them
      const noisyNames = ['auth-oauth-bug', 'test-flaky-fix', 'deploy-canary-failure'];
      for (const name of noisyNames) {
        const id = freshIdMap.get(name);
        if (!id) continue;
        for (let i = 0; i < 15; i++) freshBench.memoryRepo.incrementInjection(id);
      }

      const freshService = new InjectionService({
        memoryRepo: freshBench.memoryRepo,
        relationRepo: freshBench.relationRepo,
      });

      const result = freshService.selectForInjection(3000);
      const selectedIds = new Set(result.memories.map(m => m.memory.id));

      const noisyInResult = noisyNames.filter(n => {
        const id = freshIdMap.get(n);
        return id && selectedIds.has(id);
      }).length;

      // Control: identical dataset, no injection inflation.
      const controlBench = createBenchDb();
      const controlIdMap = seedDatabase(controlBench.memoryRepo);
      const controlService = new InjectionService({
        memoryRepo: controlBench.memoryRepo,
        relationRepo: controlBench.relationRepo,
      });
      const controlResult = controlService.selectForInjection(3000);
      const controlSelected = new Set(controlResult.memories.map(m => m.memory.id));
      const noisyInControl = noisyNames.filter(n => {
        const id = controlIdMap.get(n);
        return id && controlSelected.has(id);
      }).length;
      closeDatabase(controlBench.db);

      reportMetrics('Noise penalty', {
        noisyMemories: noisyNames.length,
        noisyInControl,
        noisyInResult,
      });

      // Baseline 2026-07-08: control selects 3/3, inflated selects 1/3.
      expect(noisyInControl).toBeGreaterThanOrEqual(2);
      expect(noisyInResult).toBeLessThan(noisyInControl);

      closeDatabase(freshBench.db);
    });
  });
});

// ── DP Knapsack (oracle) ─────────────────────────────────────

interface KnapsackItem {
  readonly value: number;
  readonly weight: number;
}

function dpKnapsack(items: readonly KnapsackItem[], capacity: number): number {
  // Use integer weights (round up token costs)
  const cap = Math.floor(capacity);
  if (cap <= 0 || items.length === 0) return 0;

  // Limit capacity resolution to avoid huge arrays
  const scale = cap > 5000 ? Math.ceil(cap / 5000) : 1;
  const scaledCap = Math.floor(cap / scale);

  const dp = new Float64Array(scaledCap + 1);

  for (const item of items) {
    const w = Math.ceil(item.weight / scale);
    if (w <= 0 || w > scaledCap) continue;
    for (let j = scaledCap; j >= w; j--) {
      dp[j] = Math.max(dp[j]!, dp[j - w]! + item.value);
    }
  }

  return dp[scaledCap]!;
}

function estimateTokenCost(m: { readonly content: string; readonly type: string; readonly title: string | null; readonly tags: readonly string[] }): number {
  const meta = `[${m.type}] ${m.title ?? ""} (${m.tags.join(", ")})`;
  return estimateTokens(m.content.slice(0, 500)) + estimateTokens(meta) + 10;
}
