import { describe, it, expect } from 'vitest';
import {
  formatError,
  formatMcpError,
  memoryNotFound,
  databaseLocked,
  databaseCorrupt,
  invalidInput,
  withRetry,
} from '../../../src/commands/memory/utils/errors.js';

describe('formatError', () => {
  it('formats what/why/fix into readable string', () => {
    const msg = formatError({
      what: 'Something broke.',
      why: 'Bad input.',
      fix: 'Try again.',
    });

    expect(msg).toContain('Something broke.');
    expect(msg).toContain('Why: Bad input.');
    expect(msg).toContain('Fix: Try again.');
  });
});

describe('formatMcpError', () => {
  it('wraps structured error in MCP error format', () => {
    const result = formatMcpError(memoryNotFound('abc-123'));

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('abc-123');
    expect(result.content[0].text).toContain('memory_search');
  });
});

describe('error templates', () => {
  it('memoryNotFound includes the ID', () => {
    const err = memoryNotFound('test-id');
    expect(err.what).toContain('test-id');
  });

  it('databaseLocked suggests doctor --fix', () => {
    const err = databaseLocked();
    expect(err.fix).toContain('doctor');
  });

  it('databaseCorrupt suggests doctor --fix', () => {
    const err = databaseCorrupt();
    expect(err.fix).toContain('doctor');
  });

  it('invalidInput includes field name and reason', () => {
    const err = invalidInput('query', 'must be at least 1 character');
    expect(err.what).toContain('query');
    expect(err.why).toContain('must be at least');
  });
});

describe('withRetry', () => {
  it('returns result on success', () => {
    const result = withRetry(() => 42, 'test');
    expect(result).toBe(42);
  });

  it('retries on SQLITE_BUSY and succeeds', () => {
    let attempts = 0;
    const result = withRetry(() => {
      attempts++;
      if (attempts < 3) throw new Error('SQLITE_BUSY');
      return 'ok';
    }, 'test');

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('throws non-SQLITE_BUSY errors immediately', () => {
    expect(() => withRetry(() => { throw new Error('other error'); }, 'test'))
      .toThrow('other error');
  });

  it('throws after exhausting retries', () => {
    expect(() => withRetry(() => { throw new Error('SQLITE_BUSY'); }, 'test'))
      .toThrow('SQLITE_BUSY');
  });
});
