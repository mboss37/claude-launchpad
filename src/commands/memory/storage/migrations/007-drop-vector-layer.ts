export const version = 7;

import type Database from 'better-sqlite3';

/**
 * WP-045: the vector layer was never wired — no embedding was ever written
 * and memories_vec was never queried. Dropping it removes the sqlite-vec
 * native dependency entirely. Guarded: fresh DBs (post-cleanup 001) have
 * neither the table nor the column.
 */
export function up(db: Database.Database): void {
  db.exec('DROP TABLE IF EXISTS memories_vec');
  const cols = db.prepare("SELECT name FROM pragma_table_info('memories')").all() as { name: string }[];
  if (cols.some((c) => c.name === 'embedding')) {
    db.exec('ALTER TABLE memories DROP COLUMN embedding');
  }
}
