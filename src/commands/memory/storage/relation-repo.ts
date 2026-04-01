import type Database from 'better-sqlite3';
import type { Relation, RelationType } from '../types.js';

interface RelationRow {
  source_id: string;
  target_id: string;
  relation_type: string;
  created_at: string;
}

function rowToRelation(row: RelationRow): Relation {
  return {
    sourceId: row.source_id,
    targetId: row.target_id,
    relationType: row.relation_type as RelationType,
    createdAt: row.created_at,
  };
}

export class RelationRepo {
  readonly #stmts;

  constructor(db: Database.Database) {
    this.#stmts = {
      insert: db.prepare(`
        INSERT OR IGNORE INTO relations (source_id, target_id, relation_type)
        VALUES (?, ?, ?)
      `),
      getBySource: db.prepare('SELECT * FROM relations WHERE source_id = ?'),
      getByTarget: db.prepare('SELECT * FROM relations WHERE target_id = ?'),
      getByMemory: db.prepare(`
        SELECT * FROM relations WHERE source_id = ? OR target_id = ?
      `),
      delete: db.prepare(`
        DELETE FROM relations WHERE source_id = ? AND target_id = ? AND relation_type = ?
      `),
      countByMemory: db.prepare(`
        SELECT COUNT(*) as count FROM relations WHERE source_id = ? OR target_id = ?
      `),
      count: db.prepare('SELECT COUNT(*) as count FROM relations'),
    };
  }

  create(sourceId: string, targetId: string, relationType: RelationType): boolean {
    const result = this.#stmts.insert.run(sourceId, targetId, relationType);
    return result.changes > 0;
  }

  getBySource(sourceId: string): readonly Relation[] {
    const rows = this.#stmts.getBySource.all(sourceId) as RelationRow[];
    return rows.map(rowToRelation);
  }

  getByTarget(targetId: string): readonly Relation[] {
    const rows = this.#stmts.getByTarget.all(targetId) as RelationRow[];
    return rows.map(rowToRelation);
  }

  getByMemory(memoryId: string): readonly Relation[] {
    const rows = this.#stmts.getByMemory.all(memoryId, memoryId) as RelationRow[];
    return rows.map(rowToRelation);
  }

  delete(sourceId: string, targetId: string, relationType: RelationType): boolean {
    const result = this.#stmts.delete.run(sourceId, targetId, relationType);
    return result.changes > 0;
  }

  countByMemory(memoryId: string): number {
    const row = this.#stmts.countByMemory.get(memoryId, memoryId) as { count: number };
    return row.count;
  }

  count(): number {
    const row = this.#stmts.count.get() as { count: number };
    return row.count;
  }
}
