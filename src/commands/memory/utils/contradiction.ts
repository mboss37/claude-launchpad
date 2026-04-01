// ── Contradiction Detection (keyword-overlap heuristic) ─────

const NEGATION_PATTERNS = [
  /\bnot\b/i,
  /\bno longer\b/i,
  /\binstead of\b/i,
  /\breplaced\b/i,
  /\bremoved\b/i,
  /\bdon'?t\b/i,
  /\bwon'?t\b/i,
  /\bshouldn'?t\b/i,
  /\bdeprecated\b/i,
  /\bdisabled\b/i,
  /\bstopped\b/i,
  /\bavoid\b/i,
  /\bnever\b/i,
  /\bwithout\b/i,
];

const KEYWORD_OVERLAP_THRESHOLD = 0.4;
const MIN_KEYWORD_LENGTH = 3;
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'from', 'that',
  'this', 'with', 'they', 'will', 'each', 'make', 'like', 'than', 'them',
  'then', 'what', 'when', 'into', 'more', 'some', 'such', 'also', 'use',
  'used', 'using', 'should', 'would', 'could', 'about', 'which', 'their',
  'there', 'these', 'those', 'does', 'done', 'just', 'very',
]);

/**
 * Extract meaningful keywords from text.
 */
function extractKeywords(text: string): ReadonlySet<string> {
  const words = text.toLowerCase().match(/[a-z][a-z0-9_-]+/g) ?? [];
  return new Set(
    words.filter(w => w.length >= MIN_KEYWORD_LENGTH && !STOP_WORDS.has(w)),
  );
}

/**
 * Check if new content potentially contradicts existing content.
 *
 * Heuristic: high keyword overlap + negation markers = likely contradiction.
 * Not perfect, but catches the common case of "we used X" vs "we no longer use X".
 */
export function checkContradiction(newContent: string, existingContent: string): boolean {
  const newKeywords = extractKeywords(newContent);
  const existingKeywords = extractKeywords(existingContent);

  if (newKeywords.size === 0 || existingKeywords.size === 0) return false;

  // Compute Jaccard-like overlap: |intersection| / |smaller set|
  let overlap = 0;
  for (const kw of newKeywords) {
    if (existingKeywords.has(kw)) overlap++;
  }

  const smallerSize = Math.min(newKeywords.size, existingKeywords.size);
  const overlapRatio = overlap / smallerSize;

  if (overlapRatio < KEYWORD_OVERLAP_THRESHOLD) return false;

  // High overlap — check for negation markers in the NEW content only.
  return NEGATION_PATTERNS.some(pattern => pattern.test(newContent));
}
