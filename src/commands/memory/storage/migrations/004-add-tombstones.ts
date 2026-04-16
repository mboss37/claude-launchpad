import type Database from 'better-sqlite3';

export const version = 4;

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_tombstones (
      id TEXT PRIMARY KEY,
      project TEXT,
      deleted_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tombstones_project ON memory_tombstones(project);
    CREATE INDEX IF NOT EXISTS idx_tombstones_deleted_at ON memory_tombstones(deleted_at);
  `);
}
