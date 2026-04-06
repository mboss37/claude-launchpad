import type Database from 'better-sqlite3';
import type { FtsMatch, MemoryType } from '../types.js';

// ── FTS5 Search ───────────────────────────────────────────────

export interface FtsSearchOptions {
  readonly query: string;
  readonly limit: number;
  readonly type?: MemoryType;
  readonly minImportance?: number;
  readonly project?: string;
}


export class SearchRepo {
  readonly #stmts;

  constructor(db: Database.Database) {
    // FTS5 search with BM25 ranking (weights: title=5.0, content=1.0, tags=2.0)
    this.#stmts = {
      ftsSearch: db.prepare(`
        SELECT
          m.rowid,
          m.id as memory_id,
          bm25(memories_fts, 5.0, 1.0, 2.0) as rank
        FROM memories_fts f
        JOIN memories m ON m.rowid = f.rowid
        WHERE memories_fts MATCH @query
        ORDER BY rank
        LIMIT @limit
      `),
      ftsSearchByProject: db.prepare(`
        SELECT
          m.rowid,
          m.id as memory_id,
          bm25(memories_fts, 5.0, 1.0, 2.0) as rank
        FROM memories_fts f
        JOIN memories m ON m.rowid = f.rowid
        WHERE memories_fts MATCH @query
          AND (m.project = @project OR m.project IS NULL)
        ORDER BY rank
        LIMIT @limit
      `),
      ftsSearchFiltered: db.prepare(`
        SELECT
          m.rowid,
          m.id as memory_id,
          bm25(memories_fts, 5.0, 1.0, 2.0) as rank
        FROM memories_fts f
        JOIN memories m ON m.rowid = f.rowid
        WHERE memories_fts MATCH @query
          AND m.type = @type
          AND m.importance >= @minImportance
        ORDER BY rank
        LIMIT @limit
      `),
      ftsSearchFilteredByProject: db.prepare(`
        SELECT
          m.rowid,
          m.id as memory_id,
          bm25(memories_fts, 5.0, 1.0, 2.0) as rank
        FROM memories_fts f
        JOIN memories m ON m.rowid = f.rowid
        WHERE memories_fts MATCH @query
          AND m.type = @type
          AND m.importance >= @minImportance
          AND (m.project = @project OR m.project IS NULL)
        ORDER BY rank
        LIMIT @limit
      `),
    };
  }

  /**
   * Full-text search using BM25 ranking.
   * Returns matches sorted by relevance (most relevant first).
   */
  searchFts(options: FtsSearchOptions): readonly FtsMatch[] {
    const ftsQuery = toFtsQuery(options.query);
    if (!ftsQuery) return [];

    try {
      const hasType = !!options.type;
      const hasProject = !!options.project;

      let rows: FtsRow[];
      if (hasType && hasProject) {
        rows = this.#stmts.ftsSearchFilteredByProject.all({
          query: ftsQuery, limit: options.limit,
          type: options.type, minImportance: options.minImportance ?? 0,
          project: options.project,
        }) as FtsRow[];
      } else if (hasType) {
        rows = this.#stmts.ftsSearchFiltered.all({
          query: ftsQuery, limit: options.limit,
          type: options.type, minImportance: options.minImportance ?? 0,
        }) as FtsRow[];
      } else if (hasProject) {
        rows = this.#stmts.ftsSearchByProject.all({
          query: ftsQuery, limit: options.limit,
          project: options.project,
        }) as FtsRow[];
      } else {
        rows = this.#stmts.ftsSearch.all({
          query: ftsQuery, limit: options.limit,
        }) as FtsRow[];
      }

      return rows.map(r => ({
        rowid: r.rowid,
        memoryId: r.memory_id,
        rank: r.rank,
      }));
    } catch (err) {
      // FTS5 MATCH throws on invalid query syntax - degrade gracefully
      console.error('[agentic-memory] FTS5 search error:', err instanceof Error ? err.message : err);
      return [];
    }
  }

}

// ── Internal helpers ──────────────────────────────────────────

interface FtsRow {
  rowid: number;
  memory_id: string;
  rank: number;
}

// Synonym expansion for common dev terms
const SYNONYMS: Record<string, readonly string[]> = {
  auth: ['authentication', 'login', 'oauth', 'jwt'],
  authentication: ['auth', 'login', 'oauth'],
  login: ['auth', 'authentication', 'signin'],
  db: ['database', 'sql', 'sqlite', 'postgres'],
  database: ['db', 'sql', 'sqlite', 'postgres'],
  api: ['endpoint', 'route', 'rest', 'graphql'],
  deploy: ['deployment', 'release', 'ship', 'publish'],
  test: ['testing', 'spec', 'jest', 'vitest'],
  config: ['configuration', 'settings', 'setup'],
  err: ['error', 'exception', 'crash', 'bug'],
  error: ['err', 'exception', 'crash', 'bug'],
};

/**
 * Convert a natural language query to FTS5 query syntax.
 * Expands synonyms and wraps words in quotes for safe matching.
 */
function toFtsQuery(input: string): string | null {
  const words = input
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) return null;

  const expanded = words.flatMap((w) => {
    const lower = w.toLowerCase();
    const syns = SYNONYMS[lower];
    return syns ? [w, ...syns] : [w];
  });

  return [...new Set(expanded)].map(w => `"${w}"`).join(' OR ');
}
