export const version = 5;

import type Database from 'better-sqlite3';

/**
 * WP-044: decay must be a pure function of age. `importance` becomes the
 * displayed/query value that decay recomputes; `base_importance` is the
 * immutable anchor set at creation (or explicit user re-rating) that the
 * decay formula multiplies. Backfill: current importance is the best
 * available approximation of base for existing rows.
 */
export function up(db: Database.Database): void {
  db.exec('ALTER TABLE memories ADD COLUMN base_importance REAL');
  db.exec('UPDATE memories SET base_importance = importance');
}
