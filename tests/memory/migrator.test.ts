import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, closeDatabase } from './fixtures/test-db.js';
import { getSchemaVersion } from '../../src/commands/memory/storage/migrator.js';
import type Database from 'better-sqlite3';

describe('migrator', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('should run initial migration and set schema version', () => {
    expect(getSchemaVersion(db)).toBe(4);
  });

  it('should create memories table with correct columns', () => {
    const info = db.prepare("PRAGMA table_info('memories')").all() as { name: string }[];
    const columns = info.map(c => c.name);
    expect(columns).toContain('id');
    expect(columns).toContain('type');
    expect(columns).toContain('title');
    expect(columns).toContain('content');
    expect(columns).toContain('context');
    expect(columns).toContain('source');
    expect(columns).toContain('tags');
    expect(columns).toContain('importance');
    expect(columns).toContain('created_at');
    expect(columns).toContain('updated_at');
    expect(columns).toContain('access_count');
    expect(columns).toContain('last_accessed');
    expect(columns).toContain('injection_count');
    expect(columns).toContain('embedding');
    expect(columns).toContain('project');
    expect(columns).toContain('content_hash');
  });

  it('should create relations table', () => {
    const info = db.prepare("PRAGMA table_info('relations')").all() as { name: string }[];
    const columns = info.map(c => c.name);
    expect(columns).toContain('source_id');
    expect(columns).toContain('target_id');
    expect(columns).toContain('relation_type');
    expect(columns).toContain('created_at');
  });

  it('should create FTS5 virtual table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='memories_fts'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('should create vec0 virtual table', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='memories_vec'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('should create indexes', () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
    ).all() as { name: string }[];
    const names = indexes.map(i => i.name);
    expect(names).toContain('idx_memories_type');
    expect(names).toContain('idx_memories_importance');
    expect(names).toContain('idx_memories_created_at');
    expect(names).toContain('idx_relations_target');
    expect(names).toContain('idx_memories_project');
  });

  it('should be idempotent (running migrate twice is safe)', async () => {
    const { migrate } = await import('../../src/commands/memory/storage/migrator.js');
    migrate(db);
    expect(getSchemaVersion(db)).toBe(4);
  });

  it('should create memory_tombstones table', () => {
    const info = db.prepare("PRAGMA table_info('memory_tombstones')").all() as { name: string }[];
    const columns = info.map(c => c.name);
    expect(columns).toContain('id');
    expect(columns).toContain('project');
    expect(columns).toContain('deleted_at');
  });
});
