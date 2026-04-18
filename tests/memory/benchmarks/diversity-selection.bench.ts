import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createBenchDb, closeDatabase, reportMetrics, type BenchDb } from './fixtures/bench-harness.js';
import { InjectionService } from '../../../src/commands/memory/services/injection-service.js';
import { applyMMR } from '../../../src/commands/memory/utils/mmr.js';
import {
  INJECTION_MMR_LAMBDA,
  INJECTION_MMR_MAX_RERANK,
  INJECTION_MMR_SIM_WEIGHTS,
} from '../../../src/commands/memory/config.js';
import type { Memory } from '../../../src/commands/memory/types.js';

// ── Clustered Dataset ─────────────────────────────────────────
// 5 topic clusters × 5 near-duplicates each + 5 distinct singletons.
// Without MMR, greedy relevance lets one cluster dominate the top.
// With MMR, the top picks should span ≥4 of 5 clusters.

interface Cluster {
  readonly tag: string;
  readonly variants: readonly string[];
}

const CLUSTERS: readonly Cluster[] = [
  {
    tag: 'packages',
    variants: [
      'use pnpm for package installation not npm or yarn strict',
      'pnpm not npm for installing packages across the repo',
      'package manager pnpm never npm yarn for monorepo installs',
      'install packages only with pnpm yarn npm are forbidden',
      'pnpm is canonical for package installs not yarn not npm',
    ],
  },
  {
    tag: 'react',
    variants: [
      'prefer react server components over client by default',
      'server components first use client only when interactivity needed',
      'react server components default client boundary minimal',
      'use client directive sparingly server components win',
      'server components over client components for data fetching',
    ],
  },
  {
    tag: 'types',
    variants: [
      'typescript strict mode no implicit any no any types',
      'no any types allowed strict mode only unknown narrowing',
      'strict typescript forbid any use unknown for runtime values',
      'typescript strict never use any unknown narrowing instead',
      'any type is forbidden strict mode unknown with narrowing',
    ],
  },
  {
    tag: 'tailwind',
    variants: [
      'tailwind utility classes mobile first responsive design',
      'mobile first responsive design with tailwind utilities direct',
      'responsive tailwind mobile first breakpoints utility classes',
      'tailwind mobile first not desktop first utility classes direct',
      'tailwind direct utility mobile first responsive no css files',
    ],
  },
  {
    tag: 'testing',
    variants: [
      'vitest for unit tests worker pool isolation per file',
      'vitest parallel worker isolation per test file unit layer',
      'unit tests vitest worker pool isolation by default',
      'vitest workers per file isolation parallel unit tests',
      'worker pool vitest isolation unit tests per file parallel',
    ],
  },
];

const SINGLETONS: readonly { readonly tag: string; readonly content: string }[] = [
  { tag: 'prisma', content: 'prisma schema migrations connection pooling production' },
  { tag: 'deploy', content: 'vercel deploy preview branches automatic env promotion' },
  { tag: 'auth', content: 'nextauth session callbacks token refresh jwt strategy' },
  { tag: 'cache', content: 'redis cache ttl strategy stale while revalidate swr' },
  { tag: 'logging', content: 'pino structured logs json output level filter redact' },
];

function seedClusters(bench: BenchDb): void {
  // First cluster gets elevated importance (0.7, still non-pinned) to simulate
  // the failure mode: one topic crowds the top-N under pure relevance ranking.
  const DOMINANT_TAG = CLUSTERS[0]!.tag;
  for (const { tag, variants } of CLUSTERS) {
    const importance = tag === DOMINANT_TAG ? 0.7 : 0.5;
    for (let i = 0; i < variants.length; i++) {
      bench.memoryRepo.create(
        { type: 'semantic', content: variants[i]!, tags: [tag], importance, source: 'manual' },
        null,
      );
    }
  }
  for (const { tag, content } of SINGLETONS) {
    bench.memoryRepo.create(
      { type: 'semantic', content, tags: [tag], importance: 0.5, source: 'manual' },
      null,
    );
  }
}

function topicCoverage(memories: readonly { readonly memory: Memory }[], topN: number): number {
  const tags = new Set<string>();
  for (const { memory } of memories.slice(0, topN)) {
    for (const t of memory.tags) tags.add(t);
  }
  return tags.size;
}

// ── Benchmark ─────────────────────────────────────────────────

describe('Diversity Selection Benchmarks', () => {
  let bench: BenchDb;
  let service: InjectionService;

  beforeAll(() => {
    bench = createBenchDb();
    seedClusters(bench);
    service = new InjectionService({
      memoryRepo: bench.memoryRepo,
      relationRepo: bench.relationRepo,
    });
  });

  afterAll(() => closeDatabase(bench.db));

  it('MMR top-5 spans at least 4 distinct topics', () => {
    const result = service.selectForInjection(3000);
    const coverage = topicCoverage(result.memories, 5);

    reportMetrics('Top-5 topic coverage (MMR)', {
      topicsInTop5: coverage,
      clustersSeeded: CLUSTERS.length,
      singletonsSeeded: SINGLETONS.length,
      totalMemories: result.totalCount,
      selected: result.memories.length,
    });

    expect(coverage).toBeGreaterThanOrEqual(4);
  });

  it('MMR improves top-5 coverage vs pure relevance sort', () => {
    // Synthetic scoring that forces the failure mode: the dominant cluster
    // takes all top slots under pure relevance. MMR must spread them.
    const all = bench.memoryRepo.getAll().filter((m) => m.type !== 'working' && m.importance >= 0.05);
    const dominantTag = CLUSTERS[0]!.tag;
    // Realistic relevance gap — production scoring differs by ~0.05-0.15
    // between similar-quality memories, not by a full 0.4 margin.
    const scored = all
      .map((m) => ({
        memory: m,
        score: m.tags.includes(dominantTag) ? 0.80 : 0.65,
      }))
      .sort((a, b) => b.score - a.score);

    const baselineCoverage = topicCoverage(scored, 5);

    const diversified = applyMMR(scored, {
      lambda: INJECTION_MMR_LAMBDA,
      maxRerank: INJECTION_MMR_MAX_RERANK,
      contentWeight: INJECTION_MMR_SIM_WEIGHTS.content,
      tagsWeight: INJECTION_MMR_SIM_WEIGHTS.tags,
    });
    const mmrCoverage = topicCoverage(diversified, 5);

    reportMetrics('Coverage gain under crowding', {
      baselineTopicsInTop5: baselineCoverage,
      mmrTopicsInTop5: mmrCoverage,
      delta: mmrCoverage - baselineCoverage,
    });

    expect(baselineCoverage).toBeLessThanOrEqual(2);
    expect(mmrCoverage).toBeGreaterThanOrEqual(4);
    expect(mmrCoverage).toBeGreaterThan(baselineCoverage);
  });

  it('MMR preserves relevance order when lambda=1', () => {
    const all = bench.memoryRepo.getAll().filter((m) => m.type !== 'working' && m.importance >= 0.05);
    const scored = all
      .map((m, i) => ({ memory: m, score: 1 - i / all.length }))
      .sort((a, b) => b.score - a.score);

    const reranked = applyMMR(scored, {
      lambda: 1,
      maxRerank: INJECTION_MMR_MAX_RERANK,
      contentWeight: INJECTION_MMR_SIM_WEIGHTS.content,
      tagsWeight: INJECTION_MMR_SIM_WEIGHTS.tags,
    });

    expect(reranked.map((s) => s.memory.id)).toEqual(scored.map((s) => s.memory.id));
  });
});
