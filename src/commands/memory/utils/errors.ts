// ── Structured Error Formatting ──────────────────────────────
// Every error answers: What happened? Why? What to do?

export interface StructuredError {
  readonly what: string;
  readonly why: string;
  readonly fix: string;
}

export function formatError(err: StructuredError): string {
  return `${err.what}\nWhy: ${err.why}\nFix: ${err.fix}`;
}

export function formatMcpError(err: StructuredError): { isError: true; content: [{ type: 'text'; text: string }] } {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: formatError(err) }],
  };
}

// ── Common Error Templates ───────────────────────────────────

export function memoryNotFound(id: string): StructuredError {
  return {
    what: `Memory "${id}" not found.`,
    why: 'The ID may be incorrect, or the memory was deleted or pruned.',
    fix: 'Use memory_search to find valid IDs.',
  };
}

export function databaseLocked(): StructuredError {
  return {
    what: 'Database is temporarily locked.',
    why: 'Another process is writing to the database (SQLITE_BUSY).',
    fix: 'Retry in a moment. If persistent, run: claude-launchpad doctor --fix',
  };
}

export function databaseCorrupt(): StructuredError {
  return {
    what: 'Database integrity check failed.',
    why: 'The database file may be corrupted (disk error, incomplete write).',
    fix: 'Run: claude-launchpad doctor --fix (creates backup, reinitializes DB)',
  };
}

export function diskFull(): StructuredError {
  return {
    what: 'Disk write failed — not enough space.',
    why: 'The disk partition containing ~/.agentic-memory is full.',
    fix: 'Free disk space, then run: claude-launchpad doctor --fix',
  };
}

export function invalidInput(field: string, reason: string): StructuredError {
  return {
    what: `Invalid input: ${field}`,
    why: reason,
    fix: 'Check the parameter value and try again.',
  };
}

// ── SQLite Retry Logic ───────────────────────────────────────

const RETRY_DELAYS = [100, 200, 400] as const;

export function withRetry<T>(fn: () => T, label: string): T {
  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
    try {
      return fn();
    } catch (err) {
      if (isSqliteBusy(err) && attempt < RETRY_DELAYS.length - 1) {
        const delay = RETRY_DELAYS[attempt]!;
        process.stderr.write(`[memory] ${label}: SQLITE_BUSY, retrying in ${delay}ms\n`);
        sleepSync(delay);
        continue;
      }
      throw err;
    }
  }
  // Unreachable, but TypeScript needs it
  throw new Error(`${label}: exhausted retries`);
}

function isSqliteBusy(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('SQLITE_BUSY') || err.message.includes('database is locked');
  }
  return false;
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
