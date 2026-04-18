import { describe, it, expect } from 'vitest';
import {
  extractKeywords,
  jaccardOverlap,
  smallerSetOverlap,
} from '../../../src/commands/memory/utils/similarity.js';

describe('extractKeywords', () => {
  it('returns non-empty keyword set for normal text', () => {
    const kw = extractKeywords('The database uses SQLite with FTS5 search');
    expect(kw.has('database')).toBe(true);
    expect(kw.has('sqlite')).toBe(true);
    expect(kw.has('fts5')).toBe(true);
    expect(kw.has('search')).toBe(true);
  });

  it('filters stop words', () => {
    const kw = extractKeywords('the and for are but');
    expect(kw.size).toBe(0);
  });

  it('filters tokens shorter than 3 chars', () => {
    const kw = extractKeywords('a b cd efg');
    expect(kw.has('efg')).toBe(true);
    expect(kw.has('cd')).toBe(false);
    expect(kw.has('a')).toBe(false);
  });

  it('lowercases input', () => {
    const kw = extractKeywords('SQLite STORAGE');
    expect(kw.has('sqlite')).toBe(true);
    expect(kw.has('storage')).toBe(true);
    expect(kw.has('SQLite')).toBe(false);
  });

  it('handles hyphenated and underscored tokens', () => {
    const kw = extractKeywords('better-sqlite3 and sqlite_vec');
    expect(kw.has('better-sqlite3')).toBe(true);
    expect(kw.has('sqlite_vec')).toBe(true);
  });

  it('returns empty set for empty input', () => {
    expect(extractKeywords('').size).toBe(0);
  });

  it('deduplicates repeated words', () => {
    const kw = extractKeywords('database database database schema');
    expect(kw.size).toBe(2);
  });
});

describe('jaccardOverlap', () => {
  it('returns 1 for identical sets', () => {
    const a = new Set(['x', 'y', 'z']);
    const b = new Set(['x', 'y', 'z']);
    expect(jaccardOverlap(a, b)).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    const a = new Set(['x', 'y']);
    const b = new Set(['a', 'b']);
    expect(jaccardOverlap(a, b)).toBe(0);
  });

  it('returns 0 for empty sets', () => {
    expect(jaccardOverlap(new Set(), new Set(['x']))).toBe(0);
    expect(jaccardOverlap(new Set(['x']), new Set())).toBe(0);
    expect(jaccardOverlap(new Set<string>(), new Set<string>())).toBe(0);
  });

  it('computes standard Jaccard ratio (intersection / union)', () => {
    const a = new Set(['x', 'y', 'z']);
    const b = new Set(['y', 'z', 'w']);
    // intersection = 2 {y,z}, union = 4 {x,y,z,w}
    expect(jaccardOverlap(a, b)).toBe(0.5);
  });

  it('is symmetric', () => {
    const a = new Set(['a', 'b', 'c', 'd']);
    const b = new Set(['c', 'd', 'e']);
    expect(jaccardOverlap(a, b)).toBe(jaccardOverlap(b, a));
  });
});

describe('smallerSetOverlap', () => {
  it('returns 1 when smaller set is fully contained in larger', () => {
    const small = new Set(['a', 'b']);
    const big = new Set(['a', 'b', 'c', 'd']);
    expect(smallerSetOverlap(small, big)).toBe(1);
  });

  it('returns 0 for disjoint sets', () => {
    expect(smallerSetOverlap(new Set(['x']), new Set(['y']))).toBe(0);
  });

  it('returns 0 when either set is empty', () => {
    expect(smallerSetOverlap(new Set(), new Set(['x']))).toBe(0);
    expect(smallerSetOverlap(new Set(['x']), new Set())).toBe(0);
  });

  it('divides intersection by smaller set size', () => {
    const a = new Set(['x', 'y', 'z']);
    const b = new Set(['y', 'z']);
    // intersection = 2, smaller = 2 → 1.0
    expect(smallerSetOverlap(a, b)).toBe(1);
  });

  it('is symmetric', () => {
    const a = new Set(['a', 'b', 'c']);
    const b = new Set(['b', 'c', 'd', 'e']);
    expect(smallerSetOverlap(a, b)).toBe(smallerSetOverlap(b, a));
  });
});
