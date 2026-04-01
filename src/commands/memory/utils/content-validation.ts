// ── Content Validation for memory_store ─────────────────────

export interface ValidationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly warnings: readonly string[];
}

const SOFT_LENGTH_LIMIT = 1500;
const HARD_LENGTH_LIMIT = 5000;
const CODE_RATIO_THRESHOLD = 0.5;

/**
 * Validate memory content before storage.
 * Returns hard rejections (don't store) and soft warnings (store but warn).
 */
export function validateMemoryContent(content: string): ValidationResult {
  const warnings: string[] = [];

  // Hard reject: git log output
  if (isGitLog(content)) {
    return { valid: false, reason: 'Content looks like raw git log output. Use git log directly — don\'t store it as memory.', warnings: [] };
  }

  // Hard reject: code-heavy content
  if (isCodeHeavy(content)) {
    return { valid: false, reason: 'Content is >50% code blocks. Code belongs in files, not memory. Store the insight or decision instead.', warnings: [] };
  }

  // Hard reject: too long
  if (content.length > HARD_LENGTH_LIMIT) {
    return { valid: false, reason: `Content is ${content.length} chars (limit: ${HARD_LENGTH_LIMIT}). Break it into smaller, atomic memories.`, warnings: [] };
  }

  // Soft warn: lengthy
  if (content.length > SOFT_LENGTH_LIMIT) {
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
