export const version = 6;

import type Database from 'better-sqlite3';

/**
 * WP-046: content dedup is a per-project concern. The global UNIQUE index
 * blocked the same insight from existing in two projects and made sync
 * silently drop same-content/different-id rows from other machines.
 * COALESCE keeps NULL-project (global) rows deduping among themselves.
 */
export function up(db: Database.Database): void {
  db.exec('DROP INDEX IF EXISTS idx_memories_content_hash');
  db.exec("CREATE UNIQUE INDEX idx_memories_content_hash ON memories(content_hash, COALESCE(project, '_global'))");
}
