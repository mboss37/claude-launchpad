import { createTestDb, closeDatabase } from '../../fixtures/test-db.js';
import { MemoryRepo } from '../../../../src/commands/memory/storage/memory-repo.js';
import { RelationRepo } from '../../../../src/commands/memory/storage/relation-repo.js';
import { SearchRepo } from '../../../../src/commands/memory/storage/search-repo.js';
import type Database from 'better-sqlite3';

// ── Test DB Setup ────────────────────────────────────────────

export interface BenchDb {
  readonly db: Database.Database;
  readonly memoryRepo: MemoryRepo;
  readonly relationRepo: RelationRepo;
  readonly searchRepo: SearchRepo;
}

export function createBenchDb(): BenchDb {
  const db = createTestDb();
  return {
    db,
    memoryRepo: new MemoryRepo(db),
    relationRepo: new RelationRepo(db),
    searchRepo: new SearchRepo(db),
  };
}

export { closeDatabase };

// ── Date Helpers ─────────────────────────────────────────────

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// ── IR Metrics ───────────────────────────────────────────────

export function precisionAtK(resultIds: readonly string[], expectedIds: readonly string[], k: number): number {
  const topK = resultIds.slice(0, k);
  if (topK.length === 0) return 0;
  const expected = new Set(expectedIds);
  const hits = topK.filter(id => expected.has(id)).length;
  return hits / topK.length;
}

export function recallAtK(resultIds: readonly string[], expectedIds: readonly string[], k: number): number {
  if (expectedIds.length === 0) return 1;
  const topK = resultIds.slice(0, k);
  const expected = new Set(expectedIds);
  const hits = topK.filter(id => expected.has(id)).length;
  return hits / expectedIds.length;
}

export function meanReciprocalRank(resultIds: readonly string[], expectedIds: readonly string[]): number {
  const expected = new Set(expectedIds);
  for (let i = 0; i < resultIds.length; i++) {
    if (expected.has(resultIds[i]!)) return 1 / (i + 1);
  }
  return 0;
}

// ── Latency Measurement ──────────────────────────────────────

export interface LatencyStats {
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
  readonly mean: number;
}

export function measureLatency(fn: () => void, iterations: number): LatencyStats {
  const durations: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  return {
    p50: durations[Math.floor(durations.length * 0.5)]!,
    p95: durations[Math.floor(durations.length * 0.95)]!,
    p99: durations[Math.floor(durations.length * 0.99)]!,
    mean: durations.reduce((a, b) => a + b, 0) / durations.length,
  };
}

export async function measureAsyncLatency(fn: () => Promise<void>, iterations: number): Promise<LatencyStats> {
  const durations: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  return {
    p50: durations[Math.floor(durations.length * 0.5)]!,
    p95: durations[Math.floor(durations.length * 0.95)]!,
    p99: durations[Math.floor(durations.length * 0.99)]!,
    mean: durations.reduce((a, b) => a + b, 0) / durations.length,
  };
}

// ── Reporting ────────────────────────────────────────────────

export function reportMetrics(name: string, metrics: Record<string, number>): void {
  console.log(`\n── ${name} ──`);
  console.table(
    Object.fromEntries(
      Object.entries(metrics).map(([k, v]) => [k, Number(v.toFixed(4))]),
    ),
  );
}

export function reportLatency(name: string, stats: LatencyStats): void {
  console.log(`\n── ${name} ──`);
  console.table({
    p50: `${stats.p50.toFixed(2)}ms`,
    p95: `${stats.p95.toFixed(2)}ms`,
    p99: `${stats.p99.toFixed(2)}ms`,
    mean: `${stats.mean.toFixed(2)}ms`,
  });
}
