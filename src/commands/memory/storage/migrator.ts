import type Database from 'better-sqlite3';
import * as migration001 from './migrations/001-initial.js';
import * as migration002 from './migrations/002-add-project.js';
import * as migration003 from './migrations/003-add-content-hash.js';
import * as migration004 from './migrations/004-add-tombstones.js';

interface Migration {
  readonly version: number;
  readonly up: (db: Database.Database) => void;
}

const migrations: readonly Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
];

export function getSchemaVersion(db: Database.Database): number {
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
      { value: string } | undefined;
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

export function migrate(db: Database.Database): void {
  const current = getSchemaVersion(db);
  const pending = migrations.filter(m => m.version > current);

  if (pending.length === 0) return;

  const runMigrations = db.transaction(() => {
    for (const m of pending) {
      m.up(db);
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)")
        .run(String(m.version));
    }
  });

  runMigrations();
}
