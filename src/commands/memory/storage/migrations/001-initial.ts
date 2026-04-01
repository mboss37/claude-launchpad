import type Database from 'better-sqlite3';

export const version = 1;

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('episodic','semantic','procedural','working','pattern')),
      title TEXT,
      content TEXT NOT NULL,
      context TEXT,
      source TEXT CHECK(source IN ('manual','session_end','consolidation','hook','import')),
      tags TEXT NOT NULL DEFAULT '[]',
      importance REAL NOT NULL DEFAULT 0.5 CHECK(importance >= 0.0 AND importance <= 1.0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      access_count INTEGER NOT NULL DEFAULT 0 CHECK(access_count >= 0),
      last_accessed TEXT,
      injection_count INTEGER NOT NULL DEFAULT 0 CHECK(injection_count >= 0),
      embedding BLOB
    );

    CREATE TABLE IF NOT EXISTS relations (
      source_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
      relation_type TEXT NOT NULL CHECK(relation_type IN (
        'relates_to','depends_on','contradicts','extends','implements','derived_from'
      )),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (source_id, target_id, relation_type)
    );

    -- FTS5 external content (no data duplication)
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      title, content, tags,
      content=memories,
      content_rowid=rowid,
      tokenize='porter unicode61'
    );

    -- FTS5 sync triggers
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, title, content, tags)
      VALUES (new.rowid, new.title, new.content, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
      VALUES ('delete', old.rowid, old.title, old.content, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, title, content, tags)
      VALUES ('delete', old.rowid, old.title, old.content, old.tags);
      INSERT INTO memories_fts(rowid, title, content, tags)
      VALUES (new.rowid, new.title, new.content, new.tags);
    END;

    -- Vector search (synced manually in application code)
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_vec USING vec0(
      memory_id TEXT PRIMARY KEY,
      embedding float[384] distance_metric=cosine
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
    CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
    CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);
  `);
}
