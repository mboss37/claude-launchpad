import type Database from 'better-sqlite3';
import type { Memory, MemoryType, MemorySource, StoreInput, SyncMemoryRow, Tombstone } from '../types.js';
import { randomUUID, createHash } from 'node:crypto';

interface TombstoneRow {
  id: string;
  project: string | null;
  deleted_at: string;
}

function rowToTombstone(row: TombstoneRow): Tombstone {
  return { id: row.id, project: row.project, deletedAt: row.deleted_at };
}

function safeParseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(t => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

// ── Row shape from SQLite ─────────────────────────────────────

interface MemoryRow {
  id: string;
  type: string;
  title: string | null;
  content: string;
  context: string | null;
  source: string | null;
  project: string | null;
  tags: string;
  importance: number;
  created_at: string;
  updated_at: string;
  access_count: number;
  last_accessed: string | null;
  injection_count: number;
  embedding: Buffer | null;
}

function rowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    type: row.type as MemoryType,
    title: row.title,
    content: row.content,
    context: row.context,
    source: row.source as MemorySource | null,
    project: row.project,
    tags: safeParseTags(row.tags),
    importance: row.importance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessCount: row.access_count,
    lastAccessed: row.last_accessed,
    injectionCount: row.injection_count,
  };
}

// ── Repository ────────────────────────────────────────────────

export class MemoryRepo {
  readonly #stmts;
  readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.#stmts = {
      insert: db.prepare(`
        INSERT OR IGNORE INTO memories (id, type, title, content, context, source, project, tags, importance, created_at, updated_at, embedding, content_hash)
        VALUES (@id, @type, @title, @content, @context, @source, @project, @tags, @importance, @createdAt, @updatedAt, @embedding, @contentHash)
      `),
      getById: db.prepare('SELECT * FROM memories WHERE id = ?'),
      getAll: db.prepare('SELECT * FROM memories ORDER BY created_at DESC'),
      getAllByProject: db.prepare('SELECT * FROM memories WHERE project = ? OR project IS NULL ORDER BY created_at DESC'),
      getByType: db.prepare('SELECT * FROM memories WHERE type = ? ORDER BY created_at DESC'),
      getByTypeAndProject: db.prepare('SELECT * FROM memories WHERE type = ? AND (project = ? OR project IS NULL) ORDER BY created_at DESC'),
      getRecent: db.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?'),
      getRecentByProject: db.prepare('SELECT * FROM memories WHERE project = ? OR project IS NULL ORDER BY created_at DESC LIMIT ?'),
      getRecentByTypeAndProject: db.prepare('SELECT * FROM memories WHERE type = ? AND (project = ? OR project IS NULL) ORDER BY created_at DESC LIMIT ?'),
      update: db.prepare(`
        UPDATE memories
        SET title = @title, content = @content, context = @context, tags = @tags,
            importance = @importance, updated_at = @updatedAt, embedding = @embedding,
            content_hash = @contentHash
        WHERE id = @id
      `),
      updateImportance: db.prepare('UPDATE memories SET importance = ?, updated_at = ? WHERE id = ?'),
      updateImportanceOnly: db.prepare('UPDATE memories SET importance = ? WHERE id = ?'),
      incrementAccess: db.prepare(`
        UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id = ?
      `),
      incrementInjection: db.prepare(`
        UPDATE memories SET injection_count = injection_count + 1 WHERE id = ?
      `),
      softDelete: db.prepare('UPDATE memories SET importance = 0, updated_at = ? WHERE id = ?'),
      hardDelete: db.prepare('DELETE FROM memories WHERE id = ?'),
      deleteByType: db.prepare('DELETE FROM memories WHERE type = ?'),
      deleteByProject: db.prepare('DELETE FROM memories WHERE project = ?'),
      count: db.prepare('SELECT COUNT(*) as count FROM memories'),
      countByProject: db.prepare('SELECT COUNT(*) as count FROM memories WHERE project = ?'),
      countByType: db.prepare('SELECT type, COUNT(*) as count FROM memories GROUP BY type'),
      projectCounts: db.prepare('SELECT COALESCE(project, \'_global\') as project, COUNT(*) as count FROM memories GROUP BY project'),
      dateRange: db.prepare('SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM memories'),
      topInjected: db.prepare(`
        SELECT id, title, injection_count FROM memories
        WHERE injection_count > 0 ORDER BY injection_count DESC LIMIT ?
      `),
      insertSync: db.prepare(`
        INSERT OR IGNORE INTO memories
          (id, type, title, content, context, source, project, tags, importance,
           access_count, injection_count, created_at, updated_at, last_accessed, embedding, content_hash)
        VALUES (@id, @type, @title, @content, @context, @source, @project, @tags, @importance,
                @accessCount, @injectionCount, @createdAt, @updatedAt, @lastAccessed, NULL, @contentHash)
      `),
      updateSync: db.prepare(`
        UPDATE memories SET
          title = @title, content = @content, context = @context,
          source = @source, project = @project, tags = @tags,
          importance = @importance, access_count = @accessCount,
          injection_count = @injectionCount, updated_at = @updatedAt,
          last_accessed = @lastAccessed, content_hash = @contentHash
        WHERE id = @id
      `),
      getAllStrictProject: db.prepare(
        'SELECT * FROM memories WHERE project = ? ORDER BY created_at DESC'
      ),
      getIdProjectByType: db.prepare('SELECT id, project FROM memories WHERE type = ?'),
      getIdProjectByProject: db.prepare('SELECT id, project FROM memories WHERE project = ?'),
      tombstoneUpsert: db.prepare(`
        INSERT INTO memory_tombstones (id, project, deleted_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project = excluded.project,
          deleted_at = excluded.deleted_at
        WHERE excluded.deleted_at > memory_tombstones.deleted_at
      `),
      tombstoneGetById: db.prepare('SELECT * FROM memory_tombstones WHERE id = ?'),
      tombstoneGetAll: db.prepare('SELECT * FROM memory_tombstones ORDER BY deleted_at DESC'),
      tombstoneGetByProjectStrict: db.prepare(
        'SELECT * FROM memory_tombstones WHERE project = ? ORDER BY deleted_at DESC'
      ),
      tombstoneDelete: db.prepare('DELETE FROM memory_tombstones WHERE id = ?'),
    };
  }

  create(input: StoreInput, _embedding: Buffer | null = null): Memory | null {
    const now = new Date().toISOString();
    const id = randomUUID();
    const contentHash = createHash('sha256').update(input.content).digest('hex');

    const params = {
      id,
      type: input.type,
      title: input.title ?? null,
      content: input.content,
      context: input.context ?? null,
      source: input.source,
      project: input.project ?? null,
      tags: JSON.stringify(input.tags),
      importance: input.importance,
      createdAt: now,
      updatedAt: now,
      embedding: null,
      contentHash,
    };

    const result = this.#stmts.insert.run(params);
    if (result.changes === 0) return null;

    const row: MemoryRow = {
      id,
      type: input.type,
      title: input.title ?? null,
      content: input.content,
      context: input.context ?? null,
      source: input.source,
      project: input.project ?? null,
      tags: JSON.stringify(input.tags),
      importance: input.importance,
      created_at: now,
      updated_at: now,
      access_count: 0,
      last_accessed: null,
      injection_count: 0,
      embedding: null,
    };

    return rowToMemory(row);
  }

  getById(id: string): Memory | undefined {
    const row = this.#stmts.getById.get(id) as MemoryRow | undefined;
    return row ? rowToMemory(row) : undefined;
  }

  getAll(project?: string): readonly Memory[] {
    if (project) {
      const rows = this.#stmts.getAllByProject.all(project) as MemoryRow[];
      return rows.map(rowToMemory);
    }
    const rows = this.#stmts.getAll.all() as MemoryRow[];
    return rows.map(rowToMemory);
  }

  getRecent(limit: number, project?: string, type?: MemoryType): readonly Memory[] {
    if (type && project) {
      const rows = this.#stmts.getRecentByTypeAndProject.all(type, project, limit) as MemoryRow[];
      return rows.map(rowToMemory);
    }
    if (project) {
      const rows = this.#stmts.getRecentByProject.all(project, limit) as MemoryRow[];
      return rows.map(rowToMemory);
    }
    const rows = this.#stmts.getRecent.all(limit) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  getByType(type: MemoryType, project?: string): readonly Memory[] {
    if (project) {
      const rows = this.#stmts.getByTypeAndProject.all(type, project) as MemoryRow[];
      return rows.map(rowToMemory);
    }
    const rows = this.#stmts.getByType.all(type) as MemoryRow[];
    return rows.map(rowToMemory);
  }

  updateContent(id: string, updates: {
    readonly title?: string | null;
    readonly content?: string;
    readonly context?: string | null;
    readonly tags?: readonly string[];
    readonly importance?: number;
  }): boolean {
    const existing = this.getById(id);
    if (!existing) return false;

    const now = new Date().toISOString();

    const finalContent = updates.content ?? existing.content;
    const params = {
      id,
      title: updates.title !== undefined ? updates.title : existing.title,
      content: finalContent,
      context: updates.context !== undefined ? updates.context : existing.context,
      tags: JSON.stringify(updates.tags ?? existing.tags),
      importance: updates.importance ?? existing.importance,
      updatedAt: now,
      embedding: null,
      contentHash: createHash('sha256').update(finalContent).digest('hex'),
    };

    this.#stmts.update.run(params);
    return true;
  }

  updateImportance(id: string, importance: number): boolean {
    const now = new Date().toISOString();
    const result = this.#stmts.updateImportance.run(importance, now, id);
    return result.changes > 0;
  }

  /** Update importance without touching updated_at - used by decay to avoid resetting the clock. */
  updateImportanceOnly(id: string, importance: number): boolean {
    const result = this.#stmts.updateImportanceOnly.run(importance, id);
    return result.changes > 0;
  }

  incrementAccess(id: string): void {
    this.#stmts.incrementAccess.run(new Date().toISOString(), id);
  }

  incrementInjection(id: string): void {
    this.#stmts.incrementInjection.run(id);
  }

  softDelete(id: string): boolean {
    const result = this.#stmts.softDelete.run(new Date().toISOString(), id);
    return result.changes > 0;
  }

  hardDelete(id: string): boolean {
    const deleteAndTombstone = this.db.transaction((memoryId: string) => {
      const memory = this.getById(memoryId);
      if (!memory) return 0;
      this.#stmts.tombstoneUpsert.run(memoryId, memory.project, new Date().toISOString());
      return this.#stmts.hardDelete.run(memoryId).changes;
    });
    return deleteAndTombstone(id) > 0;
  }

  deleteByType(type: MemoryType): number {
    const deleteAndTombstone = this.db.transaction((t: MemoryType) => {
      const rows = this.#stmts.getIdProjectByType.all(t) as { id: string; project: string | null }[];
      const now = new Date().toISOString();
      for (const row of rows) {
        this.#stmts.tombstoneUpsert.run(row.id, row.project, now);
      }
      return this.#stmts.deleteByType.run(t).changes;
    });
    return deleteAndTombstone(type);
  }

  deleteByProject(project: string): number {
    const deleteAndTombstone = this.db.transaction((p: string) => {
      const rows = this.#stmts.getIdProjectByProject.all(p) as { id: string; project: string | null }[];
      const now = new Date().toISOString();
      for (const row of rows) {
        this.#stmts.tombstoneUpsert.run(row.id, row.project, now);
      }
      return this.#stmts.deleteByProject.run(p).changes;
    });
    return deleteAndTombstone(project);
  }

  getTombstone(id: string): Tombstone | null {
    const row = this.#stmts.tombstoneGetById.get(id) as TombstoneRow | undefined;
    return row ? rowToTombstone(row) : null;
  }

  getAllTombstones(): readonly Tombstone[] {
    const rows = this.#stmts.tombstoneGetAll.all() as TombstoneRow[];
    return rows.map(rowToTombstone);
  }

  getTombstonesByProject(project: string): readonly Tombstone[] {
    const rows = this.#stmts.tombstoneGetByProjectStrict.all(project) as TombstoneRow[];
    return rows.map(rowToTombstone);
  }

  upsertTombstone(id: string, project: string | null, deletedAt: string): void {
    this.#stmts.tombstoneUpsert.run(id, project, deletedAt);
  }

  deleteTombstone(id: string): void {
    this.#stmts.tombstoneDelete.run(id);
  }

  count(project?: string): number {
    if (project) {
      const row = this.#stmts.countByProject.get(project) as { count: number };
      return row.count;
    }
    const row = this.#stmts.count.get() as { count: number };
    return row.count;
  }

  countByType(): Record<string, number> {
    const rows = this.#stmts.countByType.all() as { type: string; count: number }[];
    return Object.fromEntries(rows.map(r => [r.type, r.count]));
  }

  projectCounts(): ReadonlyMap<string, number> {
    const rows = this.#stmts.projectCounts.all() as { project: string; count: number }[];
    return new Map(rows.map(r => [r.project, r.count]));
  }

  dateRange(): { oldest: string | null; newest: string | null } {
    const row = this.#stmts.dateRange.get() as { oldest: string | null; newest: string | null };
    return { oldest: row.oldest, newest: row.newest };
  }

  topInjected(limit: number = 5): readonly { id: string; title: string | null; injectionCount: number }[] {
    const rows = this.#stmts.topInjected.all(limit) as { id: string; title: string | null; injection_count: number }[];
    return rows.map(r => ({ id: r.id, title: r.title, injectionCount: r.injection_count }));
  }

  upsertFromSync(row: SyncMemoryRow): void {
    const params = {
      id: row.id,
      type: row.type,
      title: row.title,
      content: row.content,
      context: row.context,
      source: row.source,
      project: row.project,
      tags: JSON.stringify(row.tags),
      importance: row.importance,
      accessCount: row.access_count,
      injectionCount: row.injection_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastAccessed: row.last_accessed,
      contentHash: createHash('sha256').update(row.content).digest('hex'),
    };

    const existing = this.getById(row.id);
    if (existing) {
      this.#stmts.updateSync.run(params);
    } else {
      this.#stmts.insertSync.run(params);
    }
  }

  getAllForSync(project?: string): readonly Memory[] {
    if (project) {
      const rows = this.#stmts.getAllStrictProject.all(project) as MemoryRow[];
      return rows.map(rowToMemory);
    }
    return this.getAll();
  }
}
