import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createBenchDb, closeDatabase, measureLatency, measureAsyncLatency,
  reportLatency, type BenchDb,
} from './fixtures/bench-harness.js';
import { seedBulk } from './fixtures/seed-dataset.js';
import { RetrievalService } from '../../../src/commands/memory/services/retrieval-service.js';
import { InjectionService } from '../../../src/commands/memory/services/injection-service.js';
import { DecayService } from '../../../src/commands/memory/services/decay-service.js';
import { ConsolidationService } from '../../../src/commands/memory/services/consolidation-service.js';

const SCALES = [100, 500, 1_000, 5_000, 10_000] as const;
const SEARCH_QUERIES = ['authentication JWT', 'database migration', 'deploy rollback', 'error handling', 'API versioning'];
const ITERATIONS = 10;

describe('Scale Performance Benchmarks', { timeout: 120_000 }, () => {
  describe.each(SCALES)('at %d memories', (scale) => {
    let bench: BenchDb;

    beforeAll(() => {
      bench = createBenchDb();
      seedBulk(bench.memoryRepo, scale);
    });

    afterAll(() => closeDatabase(bench.db));

    it('search latency', async () => {
      const service = new RetrievalService({
        memoryRepo: bench.memoryRepo,
        relationRepo: bench.relationRepo,
        searchRepo: bench.searchRepo,
      });

      const stats = await measureAsyncLatency(async () => {
        const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)]!;
        await service.search({ query, limit: 10, min_importance: 0 });
      }, ITERATIONS);

      reportLatency(`Search (${scale} memories)`, stats);

      if (scale <= 1_000) expect(stats.p95).toBeLessThan(100);
      if (scale <= 5_000) expect(stats.p95).toBeLessThan(300);
      if (scale <= 10_000) expect(stats.p95).toBeLessThan(1000);
    });

    it('injection latency', () => {
      const service = new InjectionService({
        memoryRepo: bench.memoryRepo,
        relationRepo: bench.relationRepo,
      });

      const stats = measureLatency(() => {
        service.selectForInjection(3000);
      }, ITERATIONS);

      reportLatency(`Injection (${scale} memories)`, stats);

      if (scale <= 1_000) expect(stats.p95).toBeLessThan(100);
      if (scale <= 5_000) expect(stats.p95).toBeLessThan(500);
      if (scale <= 10_000) expect(stats.p95).toBeLessThan(2000);
    });

    it('decay sweep latency', () => {
      const service = new DecayService({
        memoryRepo: bench.memoryRepo,
        relationRepo: bench.relationRepo,
      });

      const stats = measureLatency(() => {
        service.decayAll();
      }, Math.min(ITERATIONS, 5));

      reportLatency(`Decay sweep (${scale} memories)`, stats);

      if (scale <= 1_000) expect(stats.p95).toBeLessThan(200);
      if (scale <= 10_000) expect(stats.p95).toBeLessThan(2000);
    });

    it('consolidation latency', async () => {
      const service = new ConsolidationService({
        memoryRepo: bench.memoryRepo,
        relationRepo: bench.relationRepo,
      });

      const stats = await measureAsyncLatency(async () => {
        await service.consolidate();
      }, Math.min(ITERATIONS, 3));

      reportLatency(`Consolidation (${scale} memories)`, stats);

      if (scale <= 1_000) expect(stats.p95).toBeLessThan(500);
      // Consolidation is O(n²) dedup — gets expensive
      if (scale <= 5_000) expect(stats.p95).toBeLessThan(10_000);
    });
  });
});
