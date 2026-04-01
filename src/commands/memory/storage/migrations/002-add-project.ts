import type Database from 'better-sqlite3';

export const version = 2;

export function up(db: Database.Database): void {
  db.exec(`
    ALTER TABLE memories ADD COLUMN project TEXT;
    CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
  `);
}
