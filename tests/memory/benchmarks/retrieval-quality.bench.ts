import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createBenchDb, closeDatabase, precisionAtK, recallAtK,
  meanReciprocalRank, reportMetrics, type BenchDb,
} from './fixtures/bench-harness.js';
import { seedDatabase, seedRelations, type IdMap } from './fixtures/seed-dataset.js';
import { BENCHMARK_QUERIES } from './fixtures/query-dataset.js';
import { RetrievalService } from '../../../src/commands/memory/services/retrieval-service.js';

describe('Retrieval Quality Benchmarks', () => {
  let bench: BenchDb;
  let idMap: IdMap;
  let service: RetrievalService;

  beforeAll(() => {
    bench = createBenchDb();
    idMap = seedDatabase(bench.memoryRepo);
    seedRelations(bench.relationRepo, idMap);
    service = new RetrievalService({
      memoryRepo: bench.memoryRepo,
      relationRepo: bench.relationRepo,
      searchRepo: bench.searchRepo,
    });
  });

  afterAll(() => closeDatabase(bench.db));

  function resolveIds(names: readonly string[]): string[] {
    return names.map(n => idMap.get(n)).filter((id): id is string => !!id);
  }

  describe('aggregate metrics', () => {
    it('Precision@5 across all queries', async () => {
      let totalP5 = 0;
      const perQuery: Record<string, number> = {};

      for (const q of BENCHMARK_QUERIES) {
        const results = await service.search({ query: q.query, limit: 10, min_importance: 0 });
        const resultIds = results.map(r => r.memory.id);
        const expectedIds = resolveIds(q.expectedNames);
        const p5 = precisionAtK(resultIds, expectedIds, 5);
        totalP5 += p5;
        perQuery[q.description] = p5;
      }

      const avgP5 = totalP5 / BENCHMARK_QUERIES.length;
      reportMetrics('Precision@5 per query', perQuery);
      reportMetrics('Precision@5 aggregate', { average: avgP5 });

      expect(avgP5).toBeGreaterThanOrEqual(0.42); // baseline 0.456 (2026-07-08); text-weight-zero mutation scores 0.416
    });

    it('Precision@10 across all queries', async () => {
      let totalP10 = 0;

      for (const q of BENCHMARK_QUERIES) {
        const results = await service.search({ query: q.query, limit: 10, min_importance: 0 });
        const resultIds = results.map(r => r.memory.id);
        const expectedIds = resolveIds(q.expectedNames);
        totalP10 += precisionAtK(resultIds, expectedIds, 10);
      }

      const avgP10 = totalP10 / BENCHMARK_QUERIES.length;
      reportMetrics('Precision@10 aggregate', { average: avgP10 });
      expect(avgP10).toBeGreaterThanOrEqual(0.35); // baseline 0.386
    });

    it('Recall@5 across all queries', async () => {
      let totalR5 = 0;

      for (const q of BENCHMARK_QUERIES) {
        const results = await service.search({ query: q.query, limit: 10, min_importance: 0 });
        const resultIds = results.map(r => r.memory.id);
        const expectedIds = resolveIds(q.expectedNames);
        totalR5 += recallAtK(resultIds, expectedIds, 5);
      }

      const avgR5 = totalR5 / BENCHMARK_QUERIES.length;
      reportMetrics('Recall@5 aggregate', { average: avgR5 });
      expect(avgR5).toBeGreaterThanOrEqual(0.85); // baseline 0.939; mutation scores 0.794
    });

    it('Recall@10 across all queries', async () => {
      let totalR10 = 0;

      for (const q of BENCHMARK_QUERIES) {
        const results = await service.search({ query: q.query, limit: 10, min_importance: 0 });
        const resultIds = results.map(r => r.memory.id);
        const expectedIds = resolveIds(q.expectedNames);
        totalR10 += recallAtK(resultIds, expectedIds, 10);
      }

      const avgR10 = totalR10 / BENCHMARK_QUERIES.length;
      reportMetrics('Recall@10 aggregate', { average: avgR10 });
      expect(avgR10).toBeGreaterThanOrEqual(0.90); // baseline 0.972
    });

    it('MRR across all queries', async () => {
      let totalMRR = 0;

      for (const q of BENCHMARK_QUERIES) {
        const results = await service.search({ query: q.query, limit: 10, min_importance: 0 });
        const resultIds = results.map(r => r.memory.id);
        const expectedIds = resolveIds(q.expectedNames);
        totalMRR += meanReciprocalRank(resultIds, expectedIds);
      }

      const avgMRR = totalMRR / BENCHMARK_QUERIES.length;
      reportMetrics('MRR aggregate', { average: avgMRR });
      expect(avgMRR).toBeGreaterThanOrEqual(0.78); // baseline 0.869; mutation scores 0.591
    });
  });

  describe('relation expansion', () => {
    it('surfaces connected memories not matched by text', async () => {
      // Search for "JWT setup" — should pull in related jwt-validation via extends relation
      const results = await service.search({ query: 'JWT setup guide', limit: 10, min_importance: 0 });
      const resultIds = results.map(r => r.memory.id);

      const setupId = idMap.get('auth-jwt-setup')!;
      const validationId = idMap.get('auth-jwt-validation')!;
      const refreshId = idMap.get('auth-token-refresh')!;

      // At least the direct match should be there
      expect(resultIds).toContain(setupId);
      // Related memories should appear via relation expansion
      const relatedFound = [validationId, refreshId].filter(id => resultIds.includes(id));
      expect(relatedFound.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('type filtering', () => {
    it('all results respect type filter including relation-expanded', async () => {
      const results = await service.search({
        query: 'authentication setup guide',
        type: 'procedural',
        limit: 10,
        min_importance: 0,
      });

      for (const r of results) {
        expect(r.memory.type).toBe('procedural');
      }
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('score quality', () => {
    it('high-importance memories rank above low-importance for same query', async () => {
      const results = await service.search({ query: 'authentication security', limit: 10, min_importance: 0 });
      if (results.length < 2) return;

      // Find the highest and lowest importance in results
      const importances = results.map(r => r.memory.importance);
      const highIdx = importances.indexOf(Math.max(...importances));
      const lowIdx = importances.indexOf(Math.min(...importances));

      // Higher importance should generally rank higher (lower index)
      // This is a soft check — text relevance can override
      if (importances[highIdx]! - importances[lowIdx]! > 0.3) {
        expect(highIdx).toBeLessThan(lowIdx);
      }
    });
  });

  describe('scoring discipline', () => {
    it('at equal importance, a strong text match outranks a fresher weak match', async () => {
      // Both match the query; same importance; rival is fresher but only
      // shares one weak token. Healthy weights: text advantage (~0.2) dwarfs
      // the recency delta (~0.01). With SCORING_WEIGHTS.text zeroed, the
      // fresher rival wins and this test goes red.
      const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
      const target = bench.memoryRepo.create({
        type: 'pattern',
        title: 'circuit breaker for flaky upstreams',
        content: 'Circuit breaker pattern with exponential backoff for flaky upstream retries: open after 5 failures, half-open probe, full reset on success.',
        tags: ['#resilience'], importance: 0.5, source: 'manual',
      })!;
      bench.db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?')
        .run(daysAgo(10), daysAgo(10), target.id);
      const rival = bench.memoryRepo.create({
        type: 'pattern',
        title: 'fresh unrelated note',
        content: 'A fresh note that mentions retries once among unrelated day-to-day subjects.',
        tags: ['#misc'], importance: 0.5, source: 'manual',
      })!;

      const results = await service.search({ query: 'circuit breaker exponential backoff retries', limit: 10, min_importance: 0 });
      const ids = results.map(r => r.memory.id);
      const targetRank = ids.indexOf(target.id);
      const rivalRank = ids.indexOf(rival.id);
      // Both MUST be present: if seed growth ever pushes the rival out of
      // the FTS candidate cut, this fails loudly instead of passing vacuously.
      expect(targetRank).toBeGreaterThanOrEqual(0);
      expect(rivalRank).toBeGreaterThanOrEqual(0);
      expect(targetRank).toBeLessThan(rivalRank);

      bench.memoryRepo.hardDelete(target.id);
      bench.memoryRepo.hardDelete(rival.id);
    });
  });
});
