import { describe, it, expect } from 'vitest';
import { checkContradiction } from '../../../src/commands/memory/utils/contradiction.js';

describe('checkContradiction', () => {
  it('detects negation-based contradiction', () => {
    const existing = 'We use SQLite for storage because it requires no external process';
    const newer = 'We no longer use SQLite for storage, switched to PostgreSQL';
    expect(checkContradiction(newer, existing)).toBe(true);
  });

  it('detects "replaced" contradiction', () => {
    const existing = 'Authentication uses JWT tokens with 24h expiry';
    const newer = 'Authentication replaced JWT tokens with session cookies';
    expect(checkContradiction(newer, existing)).toBe(true);
  });

  it('detects "instead of" contradiction', () => {
    const existing = 'Deploy with Docker containers on AWS ECS';
    const newer = 'Deploy with Vercel serverless instead of Docker containers';
    expect(checkContradiction(newer, existing)).toBe(true);
  });

  it('returns false for unrelated content', () => {
    const existing = 'The database schema uses normalized tables';
    const newer = 'Frontend uses React with TypeScript';
    expect(checkContradiction(newer, existing)).toBe(false);
  });

  it('returns false for similar but non-contradictory content', () => {
    const existing = 'SQLite FTS5 provides full-text search capability';
    const newer = 'SQLite FTS5 search uses BM25 ranking for scoring';
    expect(checkContradiction(newer, existing)).toBe(false);
  });

  it('handles empty content', () => {
    expect(checkContradiction('', '')).toBe(false);
    expect(checkContradiction('some content', '')).toBe(false);
    expect(checkContradiction('', 'some content')).toBe(false);
  });

  it('detects "avoid/never" contradiction', () => {
    const existing = 'Use default exports for React components';
    const newer = 'Never use default exports for React components, use named exports only';
    expect(checkContradiction(newer, existing)).toBe(true);
  });

  it('detects "deprecated" flag', () => {
    const existing = 'The embeddings service uses onnxruntime for vector generation';
    const newer = 'The embeddings service is deprecated, FTS5-only search is used';
    expect(checkContradiction(newer, existing)).toBe(true);
  });
});
