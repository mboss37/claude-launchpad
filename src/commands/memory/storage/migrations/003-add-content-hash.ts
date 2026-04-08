import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';

export const version = 3;

export function up(db: Database.Database): void {
  db.exec('ALTER TABLE memories ADD COLUMN content_hash TEXT');

  // Backfill existing rows with SHA-256 hashes
  const rows = db.prepare('SELECT id, content FROM memories ORDER BY updated_at DESC').all() as { id: string; content: string }[];
  const update = db.prepare('UPDATE memories SET content_hash = ? WHERE id = ?');
  const remove = db.prepare('DELETE FROM memories WHERE id = ?');

  // Track seen hashes — keep the most recently updated, remove older duplicates
  const seen = new Set<string>();
  for (const row of rows) {
    const hash = createHash('sha256').update(row.content).digest('hex');
    if (seen.has(hash)) {
      remove.run(row.id);
    } else {
      seen.add(hash);
      update.run(hash, row.id);
    }
  }

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_memories_content_hash ON memories(content_hash)');
}
