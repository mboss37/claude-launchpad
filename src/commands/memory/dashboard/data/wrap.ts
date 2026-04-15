/**
 * Split content into display lines, wrapping long lines at the given width.
 * Preserves empty lines.
 */
export function wrapContent(content: string, width: number): readonly string[] {
  if (width <= 0) return content.split('\n');
  const out: string[] = [];
  for (const rawLine of content.split('\n')) {
    if (rawLine.length === 0) {
      out.push('');
      continue;
    }
    for (let i = 0; i < rawLine.length; i += width) {
      out.push(rawLine.slice(i, i + width));
    }
  }
  return out;
}
