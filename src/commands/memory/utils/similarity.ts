// ── Similarity Primitives ──────────────────────────────────────
// Pure utilities for text and set similarity. Shared between
// contradiction detection and MMR diversity re-ranking.

const MIN_KEYWORD_LENGTH = 3;

const STOP_WORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'from', 'that',
  'this', 'with', 'they', 'will', 'each', 'make', 'like', 'than', 'them',
  'then', 'what', 'when', 'into', 'more', 'some', 'such', 'also', 'use',
  'used', 'using', 'should', 'would', 'could', 'about', 'which', 'their',
  'there', 'these', 'those', 'does', 'done', 'just', 'very',
]);

export function extractKeywords(text: string): ReadonlySet<string> {
  const words = text.toLowerCase().match(/[a-z][a-z0-9_-]+/g) ?? [];
  return new Set(
    words.filter((w) => w.length >= MIN_KEYWORD_LENGTH && !STOP_WORDS.has(w)),
  );
}

function intersectionSize<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): number {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let count = 0;
  for (const item of smaller) {
    if (larger.has(item)) count++;
  }
  return count;
}

export function jaccardOverlap<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const inter = intersectionSize(a, b);
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function smallerSetOverlap<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  const inter = intersectionSize(a, b);
  return inter / Math.min(a.size, b.size);
}
