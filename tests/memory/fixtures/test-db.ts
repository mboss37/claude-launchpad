import { createDatabase, closeDatabase } from '../../../src/commands/memory/storage/database.js';
import { migrate } from '../../../src/commands/memory/storage/migrator.js';
import type Database from 'better-sqlite3';

export function createTestDb(): Database.Database {
  const db = createDatabase({ dbPath: ':memory:' });
  migrate(db);
  return db;
}

export { closeDatabase };
