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
