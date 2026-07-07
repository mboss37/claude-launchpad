export const version = 7;

import type Database from 'better-sqlite3';
import { cwdRequire } from '../../utils/require-deps.js';

/**
 * WP-045: the vector layer was never wired — no embedding was ever written
 * and memories_vec was never queried. Dropping it removes the sqlite-vec
 * native dependency entirely.
 *
 * A virtual table cannot be dropped unless its module is registered, and
 * v1.14+ no longer loads sqlite-vec at open. Upgraders have the module
 * installed (the old installer ran `npm install -g better-sqlite3
 * sqlite-vec`), so we load it just for the drop. If the module is gone,
 * the vtab schema entry is left in place — it is inert (never queried,
 * blocks nothing) and direct sqlite_master surgery is forbidden by
 * better-sqlite3's SQLite build, so removal would risk more than it buys.
 */
export function up(db: Database.Database): void {
  const hasVecTable = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'memories_vec'")
    .get();
  if (hasVecTable) {
    try {
      const vec = cwdRequire('sqlite-vec') as { load: (db: Database.Database) => void };
      vec.load(db);
      db.exec('DROP TABLE memories_vec');
    } catch {
      // Module unavailable: leave the inert vtab entry. Everything below
      // still applies.
    }
  }

  const cols = db.prepare("SELECT name FROM pragma_table_info('memories')").all() as { name: string }[];
  if (cols.some((c) => c.name === 'embedding')) {
    db.exec('ALTER TABLE memories DROP COLUMN embedding');
  }
}
