// ── Transcript Parsing ──────────────────────────────────────

/**
 * Parse a Claude Code JSONL transcript file into plain text.
 * Extracts text content from user and assistant messages.
 * Only processes the last `maxMessages` messages to stay focused.
 */
export function parseTranscript(jsonlContent: string, maxMessages = 50): string {
  const lines = jsonlContent.split('\n').filter(l => l.trim().length > 0);
  const textParts: string[] = [];

  const startIdx = Math.max(0, lines.length - maxMessages);

  for (let i = startIdx; i < lines.length; i++) {
    try {
      const msg = JSON.parse(lines[i]!) as {
        type?: string;
        message?: { role?: string; content?: unknown };
      };

      if (msg.type !== 'user' && msg.type !== 'assistant') continue;

      const content = msg.message?.content;
      if (typeof content === 'string') {
        textParts.push(content);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (typeof block === 'object' && block !== null && 'type' in block && block.type === 'text' && 'text' in block) {
            textParts.push(block.text as string);
          }
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  return textParts.join('\n');
}

// ── Fact Extraction (for future session-end processing) ──────

export interface ExtractedFact {
  readonly type: 'episodic' | 'semantic' | 'procedural' | 'pattern';
  readonly content: string;
  readonly tags: readonly string[];
  readonly importance: number;
}

const MIN_FACT_LENGTH = 30;

function isNoiseLine(line: string): boolean {
  if (/<\/?[a-z-]+>/i.test(line)) return true;
  if (/^\|.*\|$/.test(line)) return true;
  if (/^```/.test(line)) return true;
  const alphaRatio = (line.match(/[a-zA-Z]/g)?.length ?? 0) / line.length;
  if (alphaRatio < 0.4 && line.length > 20) return true;
  return false;
}

export function extractFacts(transcript: string): readonly ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const lines = transcript.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 10) continue;

    if (isNoiseLine(trimmed)) continue;

    // Pattern: "decided to X because Y" -> semantic decision
    const decisionMatch = trimmed.match(/decided?\s+(?:to\s+)?(.+?)\s+because\s+(.+)/i);
    if (decisionMatch?.[1] && decisionMatch[2]) {
      facts.push({
        type: 'semantic',
        content: `Decision: ${decisionMatch[1].trim()}. Reason: ${decisionMatch[2].trim()}`,
        tags: ['decision'],
        importance: 0.7,
      });
      continue;
    }

    // Pattern: "fixed X by Y" -> episodic fix
    const fixMatch = trimmed.match(/(?:fixed|resolved|solved)\s+(.+?)\s+by\s+(.+)/i);
    if (fixMatch?.[1] && fixMatch[2]) {
      facts.push({
        type: 'episodic',
        content: `Fixed: ${fixMatch[1].trim()}. Solution: ${fixMatch[2].trim()}`,
        tags: ['bugfix'],
        importance: 0.6,
      });
      continue;
    }

    // Pattern: "learned that X" -> semantic
    const learnMatch = trimmed.match(/(?:learned|discovered|found out|realized)\s+(?:that\s+)?(.+)/i);
    if (learnMatch?.[1]) {
      facts.push({
        type: 'semantic',
        content: learnMatch[1].trim(),
        tags: ['learning'],
        importance: 0.6,
      });
      continue;
    }

    // Pattern: "to X, use Y" -> procedural
    const proceduralMatch = trimmed.match(/(?:to\s+(.+?),\s+(?:use|run|execute|call)\s+(.+))/i);
    if (proceduralMatch?.[1] && proceduralMatch[2]) {
      facts.push({
        type: 'procedural',
        content: `To ${proceduralMatch[1].trim()}: ${proceduralMatch[2].trim()}`,
        tags: ['howto'],
        importance: 0.6,
      });
      continue;
    }

    // Pattern: "gotcha: X" -> semantic gotcha
    const gotchaMatch = trimmed.match(/(?:gotcha|watch out|pitfall)[:!]\s*(.+)/i);
    if (gotchaMatch?.[1] && gotchaMatch[1].trim().length >= MIN_FACT_LENGTH) {
      facts.push({
        type: 'semantic',
        content: `Gotcha: ${gotchaMatch[1].trim()}`,
        tags: ['gotcha'],
        importance: 0.7,
      });
      continue;
    }
  }

  return facts;
}
