import { existsSync, readFileSync } from 'node:fs';
import { parseTranscript, extractFacts } from '../services/session-service.js';
import { detectProject } from '../utils/project.js';
import { initStorage } from './init-storage.js';

export async function runExtract(): Promise<void> {
  // Read hook input from stdin (Claude Code pipes JSON)
  let stdinData = '';
  try {
    stdinData = await readStdin(5000);
  } catch {
    process.stderr.write('[agentic-memory] extract: no stdin data received\n');
    return;
  }

  if (!stdinData.trim()) {
    process.stderr.write('[agentic-memory] extract: empty stdin\n');
    return;
  }

  let hookInput: { transcript_path?: string; cwd?: string };
  try {
    hookInput = JSON.parse(stdinData) as { transcript_path?: string; cwd?: string };
  } catch {
    process.stderr.write('[agentic-memory] extract: invalid JSON on stdin\n');
    return;
  }

  const transcriptPath = hookInput.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) {
    process.stderr.write(`[agentic-memory] extract: transcript not found: ${transcriptPath}\n`);
    return;
  }

  let transcriptContent: string;
  try {
    transcriptContent = readFileSync(transcriptPath, 'utf-8');
  } catch (err) {
    process.stderr.write(`[agentic-memory] extract: failed to read transcript: ${err instanceof Error ? err.message : err}\n`);
    return;
  }

  const text = parseTranscript(transcriptContent);
  if (!text || text.length < 50) return;

  const facts = extractFacts(text);
  if (facts.length === 0) return;

  const ctx = initStorage();
  const project = detectProject(hookInput.cwd ?? process.cwd());

  try {
    let stored = 0;
    for (const fact of facts) {
      // Dedup: check if similar content already exists
      try {
        const existing = ctx.searchRepo.searchFts({
          query: fact.content.slice(0, 100),
          limit: 1,
        });
        if (existing.length > 0 && Math.abs(existing[0]!.rank) > 15) {
          continue; // Strong text match = likely duplicate
        }
      } catch {
        // Dedup is best-effort
      }

      ctx.memoryRepo.create(
        {
          type: fact.type,
          content: fact.content,
          tags: [...fact.tags],
          importance: fact.importance,
          source: 'hook',
          project: project ?? undefined,
        },
        null,
      );
      stored++;
    }

    if (stored > 0) {
      process.stderr.write(`[agentic-memory] extract: stored ${stored} facts from transcript\n`);
    }
  } finally {
    ctx.close();
  }
}

function readStdin(timeoutMs: number): Promise<string> {
  if (process.stdin.isTTY) return Promise.resolve('');

  return new Promise((resolve, reject) => {
    let settled = false;
    const chunks: Buffer[] = [];

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.stdin.removeListener('data', onData);
      process.stdin.removeListener('end', onEnd);
      process.stdin.removeListener('error', onError);
      fn();
    };

    const timer = setTimeout(() => {
      settle(() => resolve(chunks.length > 0 ? Buffer.concat(chunks).toString('utf-8') : ''));
    }, timeoutMs);

    const onData = (chunk: Buffer) => { chunks.push(chunk); };
    const onEnd = () => { settle(() => resolve(Buffer.concat(chunks).toString('utf-8'))); };
    const onError = (err: Error) => { settle(() => reject(err)); };

    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onError);
  });
}
