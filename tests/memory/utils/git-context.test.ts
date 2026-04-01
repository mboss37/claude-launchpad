import { describe, it, expect } from 'vitest';
import { computeContextScore } from '../../../src/commands/memory/utils/git-context.js';
import type { GitContext } from '../../../src/commands/memory/utils/git-context.js';

describe('computeContextScore', () => {
  const ctx: GitContext = {
    branch: 'feature/auth',
    recentFiles: ['src/auth.ts', 'src/middleware.ts', 'tests/auth.test.ts'],
  };

  it('should return 0 for null storedContext', () => {
    expect(computeContextScore(null, ctx, 'auth')).toBe(0);
  });

  it('should return 0 for malformed JSON', () => {
    expect(computeContextScore('not json', ctx, 'auth')).toBe(0);
  });

  it('should return 0 for empty stored context', () => {
    expect(computeContextScore('{}', ctx, 'auth')).toBe(0);
  });

  it('should score branch match at 0.4', () => {
    const stored = JSON.stringify({ branch: 'feature/auth' });
    const score = computeContextScore(stored, ctx, '');
    expect(score).toBeCloseTo(0.4, 2);
  });

  it('should score 0 for branch mismatch', () => {
    const stored = JSON.stringify({ branch: 'main' });
    const score = computeContextScore(stored, ctx, '');
    expect(score).toBe(0);
  });

  it('should compute file Jaccard similarity', () => {
    const stored = JSON.stringify({ files: ['src/auth.ts', 'src/middleware.ts'] });
    const score = computeContextScore(stored, ctx, '');
    // Jaccard: intersection=2, union=3 (stored has 2, current has 3, overlap 2) → 2/3
    expect(score).toBeCloseTo(2 / 3 * 0.4, 2);
  });

  it('should score 0 for no file overlap', () => {
    const stored = JSON.stringify({ files: ['src/unrelated.ts'] });
    const score = computeContextScore(stored, ctx, '');
    expect(score).toBe(0);
  });

  it('should compute intent-query word overlap', () => {
    const stored = JSON.stringify({ intent: 'fixing auth bug' });
    const score = computeContextScore(stored, ctx, 'auth bug login');
    // intent words: {fixing, auth, bug}, query words: {auth, bug, login}
    // overlap=2, union=4, Jaccard=0.5 → 0.5 * 0.2 = 0.1
    expect(score).toBeCloseTo(0.1, 2);
  });

  it('should combine all components for full match', () => {
    const stored = JSON.stringify({
      branch: 'feature/auth',
      files: ['src/auth.ts', 'src/middleware.ts', 'tests/auth.test.ts'],
      intent: 'auth',
    });
    const score = computeContextScore(stored, ctx, 'auth');
    // branch: 0.4, files: Jaccard=1.0 → 0.4, intent: Jaccard=1.0 → 0.2
    expect(score).toBeCloseTo(1.0, 2);
  });

  it('should handle empty current context gracefully', () => {
    const emptyCtx: GitContext = { branch: null, recentFiles: [] };
    const stored = JSON.stringify({ branch: 'main', files: ['src/foo.ts'] });
    expect(computeContextScore(stored, emptyCtx, '')).toBe(0);
  });
});
