import { describe, it, expect } from 'vitest';
import { applyMMR, type MMRScored, type MMROptions } from '../../../src/commands/memory/utils/mmr.js';
import type { Memory } from '../../../src/commands/memory/types.js';

function makeMemory(id: string, content: string, tags: readonly string[] = []): Memory {
  return {
    id,
    type: 'semantic',
    title: id,
    content,
    context: null,
    source: null,
    project: null,
    tags,
    importance: 0.5,
    createdAt: '2026-04-18T00:00:00Z',
    updatedAt: '2026-04-18T00:00:00Z',
    accessCount: 0,
    lastAccessed: null,
    injectionCount: 0,
  };
}

function scored(id: string, score: number, content: string, tags: readonly string[] = []): MMRScored {
  return { memory: makeMemory(id, content, tags), score };
}

const DEFAULT_OPTS: MMROptions = {
  lambda: 0.7,
  maxRerank: 50,
  contentWeight: 0.6,
  tagsWeight: 0.4,
};

describe('applyMMR', () => {
  it('returns empty list unchanged', () => {
    expect(applyMMR([], DEFAULT_OPTS)).toEqual([]);
  });

  it('returns single-item list unchanged', () => {
    const items = [scored('a', 0.9, 'pnpm package manager')];
    expect(applyMMR(items, DEFAULT_OPTS)).toEqual(items);
  });

  it('preserves pure relevance order when lambda=1', () => {
    const items = [
      scored('a', 0.9, 'use pnpm for packages'),
      scored('b', 0.8, 'use pnpm not npm'),
      scored('c', 0.7, 'functions under 50 lines'),
      scored('d', 0.6, 'use named exports only'),
    ];
    const result = applyMMR(items, { ...DEFAULT_OPTS, lambda: 1 });
    expect(result.map((r) => r.memory.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('promotes diverse candidates when lambda<1', () => {
    // 3 near-duplicates on "pnpm" topic + 1 distinct. Greedy relevance picks pnpm first,
    // then MMR should prefer the distinct memory over the next pnpm duplicate.
    const items = [
      scored('pnpm1', 0.90, 'use pnpm for packages', ['pnpm']),
      scored('pnpm2', 0.85, 'pnpm not npm for packages', ['pnpm']),
      scored('pnpm3', 0.80, 'packages managed by pnpm', ['pnpm']),
      scored('lines', 0.75, 'functions under fifty lines strict', ['style']),
    ];
    const result = applyMMR(items, DEFAULT_OPTS);
    expect(result[0]?.memory.id).toBe('pnpm1');
    expect(result[1]?.memory.id).toBe('lines');
  });

  it('lambda=0 maximizes diversity after first pick', () => {
    const items = [
      scored('a1', 0.9, 'alpha bravo charlie delta', ['topic-a']),
      scored('a2', 0.8, 'alpha bravo charlie echo', ['topic-a']),
      scored('b1', 0.7, 'foxtrot golf hotel india', ['topic-b']),
    ];
    const result = applyMMR(items, { ...DEFAULT_OPTS, lambda: 0 });
    expect(result[0]?.memory.id).toBe('a1');
    expect(result[1]?.memory.id).toBe('b1');
  });

  it('handles identical content without crashing', () => {
    const items = [
      scored('x1', 0.9, 'same content', ['tag']),
      scored('x2', 0.8, 'same content', ['tag']),
      scored('x3', 0.7, 'same content', ['tag']),
    ];
    const result = applyMMR(items, DEFAULT_OPTS);
    expect(result).toHaveLength(3);
    expect(new Set(result.map((r) => r.memory.id))).toEqual(new Set(['x1', 'x2', 'x3']));
  });

  it('maxRerank caps the window; tail preserves order', () => {
    const items = [
      scored('h1', 0.95, 'duplicate alpha', ['a']),
      scored('h2', 0.90, 'duplicate alpha', ['a']),
      scored('h3', 0.85, 'distinct bravo charlie', ['b']),
      scored('tail1', 0.40, 'tail item', []),
      scored('tail2', 0.35, 'second tail', []),
    ];
    const result = applyMMR(items, { ...DEFAULT_OPTS, maxRerank: 3 });
    expect(result).toHaveLength(5);
    expect(result.slice(3).map((r) => r.memory.id)).toEqual(['tail1', 'tail2']);
  });

  it('preserves all candidates (no drops)', () => {
    const items = [
      scored('a', 0.9, 'topic alpha', []),
      scored('b', 0.7, 'topic bravo', []),
      scored('c', 0.5, 'topic charlie', []),
    ];
    const result = applyMMR(items, DEFAULT_OPTS);
    expect(result).toHaveLength(3);
    expect(new Set(result.map((r) => r.memory.id))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('tag overlap alone drives diversity when content is distinct', () => {
    const items = [
      scored('pnpm-a', 0.9, 'alpha bravo', ['pnpm']),
      scored('pnpm-b', 0.85, 'charlie delta', ['pnpm']),
      scored('other', 0.80, 'echo foxtrot', ['style']),
    ];
    const result = applyMMR(items, DEFAULT_OPTS);
    expect(result[0]?.memory.id).toBe('pnpm-a');
    expect(result[1]?.memory.id).toBe('other');
  });
});
