import { describe, it, expect } from 'vitest';
import { validateMemoryContent, isCodeHeavy, isGitLog } from '../../../src/commands/memory/utils/content-validation.js';

describe('validateMemoryContent', () => {
  it('accepts normal content', () => {
    const result = validateMemoryContent('Decided to use SQLite because it requires no external process');
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('rejects code-heavy content', () => {
    const content = '```typescript\nconst x = 1;\nconst y = 2;\nconst z = 3;\nconst a = 4;\n```\nshort note';
    const result = validateMemoryContent(content);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('code blocks');
  });

  it('rejects git log output', () => {
    const content = [
      'commit abc1234567890',
      'Author: John Doe <john@example.com>',
      'Date:   Mon Mar 30 10:00:00 2026 +0200',
      '',
      '    feat: add memory store',
      '',
      'commit def1234567890',
      'Author: Jane Doe <jane@example.com>',
      'Date:   Sun Mar 29 09:00:00 2026 +0200',
      '',
      '    fix: broken import',
    ].join('\n');
    const result = validateMemoryContent(content);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('git log');
  });

  it('accepts very long content with a strong warning (never rejects on length)', () => {
    const content = 'a'.repeat(5001);
    const result = validateMemoryContent(content);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('very long');
    expect(result.warnings[0]).toContain('5001 chars');
  });

  it('warns on content over soft limit', () => {
    const content = 'a'.repeat(1500);
    const result = validateMemoryContent(content);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('1500 chars');
  });

  it('warns strongly on content over very-long limit', () => {
    const content = 'a'.repeat(2501);
    const result = validateMemoryContent(content);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('very long');
  });

  it('accepts content at exactly soft limit', () => {
    const content = 'a'.repeat(1200);
    const result = validateMemoryContent(content);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});

describe('isCodeHeavy', () => {
  it('returns false for plain text', () => {
    expect(isCodeHeavy('This is a normal sentence about a decision we made.')).toBe(false);
  });

  it('returns true when code exceeds 50%', () => {
    const content = '```js\nconst x = 1;\nconst y = 2;\n```\nok';
    expect(isCodeHeavy(content)).toBe(true);
  });

  it('returns false when code is under 50%', () => {
    const longText = 'This is a long explanation about the architectural decision. '.repeat(5);
    const content = `${longText}\n\`\`\`js\nconst x = 1;\n\`\`\``;
    expect(isCodeHeavy(content)).toBe(false);
  });

  it('handles multiple code blocks', () => {
    const content = '```a\ncode1\n```\ntext\n```b\ncode2\nmore code\n```\nshort';
    expect(isCodeHeavy(content)).toBe(true);
  });

  it('returns false for empty content', () => {
    expect(isCodeHeavy('')).toBe(false);
  });
});

describe('isGitLog', () => {
  it('detects full git log format', () => {
    const content = [
      'commit 1234567890abcdef',
      'Author: Dev <dev@test.com>',
      'Date:   Mon Jan 1 00:00:00 2026 +0000',
      '',
      '    initial commit',
    ].join('\n');
    expect(isGitLog(content)).toBe(true);
  });

  it('detects oneline git log format', () => {
    const content = [
      'abc1234 feat: add feature',
      'def5678 fix: broken test',
      'aef9012 docs: update readme',
      'bce3456 chore: cleanup',
    ].join('\n');
    expect(isGitLog(content)).toBe(true);
  });

  it('returns false for normal text', () => {
    expect(isGitLog('We decided to use FTS5 because it provides better search.')).toBe(false);
  });

  it('returns false for text mentioning commits casually', () => {
    expect(isGitLog('The commit message should follow conventional format.')).toBe(false);
  });
});
