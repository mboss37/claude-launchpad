// ── Content Validation for memory_store ─────────────────────

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly warnings: readonly string[];
}

// Soft 1200 chars ≈ 300 tokens, very-long 2500 ≈ 600 tokens. No hard reject on length.
export const SOFT_LENGTH_LIMIT = 1200;
export const VERY_LONG_LENGTH_LIMIT = 2500;
const CODE_RATIO_THRESHOLD = 0.5;

/**
 * Validate memory content before storage.
 * Rejects only junk (git log, code-heavy). Length is warned, never rejected.
 */
export function validateMemoryContent(content: string): ValidationResult {
  const warnings: string[] = [];

  if (isGitLog(content)) {
    return { valid: false, reason: 'Content looks like raw git log output. Use git log directly — don\'t store it as memory.', warnings: [] };
  }

  if (isCodeHeavy(content)) {
    return { valid: false, reason: 'Content is >50% code blocks. Code belongs in files, not memory. Store the insight or decision instead.', warnings: [] };
  }

  if (content.length > VERY_LONG_LENGTH_LIMIT) {
    warnings.push(`Content is ${content.length} chars — very long. Next time, split this into smaller atomic memories (~500-1000 chars each) so they retrieve better and don't bloat the context window.`);
  } else if (content.length > SOFT_LENGTH_LIMIT) {
    warnings.push(`Content is ${content.length} chars. Shorter memories (<${SOFT_LENGTH_LIMIT} chars) are easier to retrieve and less likely to decay.`);
  }

  return { valid: true, warnings };
}

/**
 * Content is >50% fenced code blocks.
 */
export function isCodeHeavy(content: string): boolean {
  const fencedBlockPattern = /```[\s\S]*?```/g;
  let codeChars = 0;
  let match: RegExpExecArray | null;

  while ((match = fencedBlockPattern.exec(content)) !== null) {
    codeChars += match[0].length;
  }

  return content.length > 0 && codeChars / content.length > CODE_RATIO_THRESHOLD;
}

/**
 * Content looks like raw git log output.
 * Matches patterns like "commit abc123\nAuthor: ...\nDate: ..."
 */
export function isGitLog(content: string): boolean {
  const lines = content.split('\n');
  let gitLogLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^commit\s+[0-9a-f]{7,40}$/i.test(trimmed)) gitLogLines++;
    else if (/^Author:\s+.+/i.test(trimmed)) gitLogLines++;
    else if (/^Date:\s+.+/i.test(trimmed)) gitLogLines++;
    else if (/^[0-9a-f]{7,12}\s+\S+/i.test(trimmed) && trimmed.length < 200) gitLogLines++;
  }

  // At least 3 git-log-like lines and they make up >30% of non-empty lines
  const nonEmptyLines = lines.filter(l => l.trim().length > 0).length;
  return gitLogLines >= 3 && nonEmptyLines > 0 && gitLogLines / nonEmptyLines > 0.3;
}
