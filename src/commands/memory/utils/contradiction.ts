import { extractKeywords, smallerSetOverlap } from "./similarity.js";

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

/**
 * Check if new content potentially contradicts existing content.
 *
 * Heuristic: high keyword overlap + negation markers = likely contradiction.
 * Not perfect, but catches the common case of "we used X" vs "we no longer use X".
 */
export function checkContradiction(newContent: string, existingContent: string): boolean {
  const newKeywords = extractKeywords(newContent);
  const existingKeywords = extractKeywords(existingContent);

  const overlapRatio = smallerSetOverlap(newKeywords, existingKeywords);
  if (overlapRatio < KEYWORD_OVERLAP_THRESHOLD) return false;

  return NEGATION_PATTERNS.some((pattern) => pattern.test(newContent));
}
