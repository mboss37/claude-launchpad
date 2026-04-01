import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { resolveDataDir } from '../config.js';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface DatabaseOptions {
  readonly dbPath?: string;    // full path override (e.g. ':memory:' for tests)
  readonly dataDir?: string;   // resolved data dir (default ~/.agentic-memory)
}

export function createDatabase(options: DatabaseOptions = {}): Database.Database {
  const dbPath = options.dbPath ?? resolveDbPath(options.dataDir);

  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);

  // Load sqlite-vec extension
  sqliteVec.load(db);

  // Configure PRAGMAs (order matters: foreign_keys before any ops, journal_mode is persistent)
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.pragma('cache_size = -64000');
  db.pragma('mmap_size = 268435456');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  db.pragma('journal_size_limit = 33554432');

  return db;
}

export function closeDatabase(db: Database.Database): void {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    // Checkpoint may fail on :memory: - that's fine
  }
  db.close();
}

function resolveDbPath(dataDir?: string): string {
  const dir = resolveDataDir(dataDir ?? '~/.agentic-memory');
  return join(dir, 'memory.db');
}
