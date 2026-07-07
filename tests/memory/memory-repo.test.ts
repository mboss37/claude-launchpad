import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, closeDatabase } from './fixtures/test-db.js';
import { MemoryRepo } from '../../src/commands/memory/storage/memory-repo.js';
import type Database from 'better-sqlite3';
import type { StoreInput } from '../../src/commands/memory/types.js';

describe('MemoryRepo', () => {
  let db: Database.Database;
  let repo: MemoryRepo;

  beforeEach(() => {
    db = createTestDb();
    repo = new MemoryRepo(db);
  });

  afterEach(() => {
    closeDatabase(db);
  });

  const baseInput: StoreInput = {
    type: 'semantic',
    content: 'This project uses TypeScript with strict mode',
    title: 'Tech stack',
    tags: ['typescript', 'config'],
    importance: 0.7,
    source: 'manual',
  };

  describe('create', () => {
    it('should create a memory and return it', () => {
      const memory = repo.create(baseInput, null);
      expect(memory.id).toBeDefined();
      expect(memory.type).toBe('semantic');
      expect(memory.content).toBe('This project uses TypeScript with strict mode');
      expect(memory.title).toBe('Tech stack');
      expect(memory.tags).toEqual(['typescript', 'config']);
      expect(memory.importance).toBe(0.7);
      expect(memory.accessCount).toBe(0);
      expect(memory.injectionCount).toBe(0);
    });

    it('should sync FTS5 on insert via trigger', () => {
      repo.create(baseInput, null);
      const ftsResults = db.prepare(
        "SELECT rowid FROM memories_fts WHERE memories_fts MATCH 'typescript'"
      ).all();
      expect(ftsResults).toHaveLength(1);
    });

    it('should generate unique IDs', () => {
      const m1 = repo.create(baseInput, null);
      const m2 = repo.create({ ...baseInput, content: 'Different content' });
      expect(m1.id).not.toBe(m2.id);
    });
  });

  describe('getById', () => {
    it('should return a memory by ID', () => {
      const created = repo.create(baseInput, null);
      const found = repo.getById(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.content).toBe(baseInput.content);
    });

    it('should return undefined for non-existent ID', () => {
      expect(repo.getById('nonexistent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all memories ordered by created_at DESC', () => {
      repo.create({ ...baseInput, content: 'First' });
      repo.create({ ...baseInput, content: 'Second' });
      repo.create({ ...baseInput, content: 'Third' });

      const all = repo.getAll();
      expect(all).toHaveLength(3);
      // Most recent first
      expect(all[0]!.content).toBe('Third');
    });
  });

  describe('getByType', () => {
    it('should filter by memory type', () => {
      repo.create({ ...baseInput, type: 'semantic' });
      repo.create({ ...baseInput, type: 'episodic', content: 'Debugged auth' });
      repo.create({ ...baseInput, type: 'semantic', content: 'Uses pnpm' });

      const semantics = repo.getByType('semantic');
      expect(semantics).toHaveLength(2);
      for (const m of semantics) {
        expect(m.type).toBe('semantic');
      }
    });
  });

  describe('updateContent', () => {
    it('should update specified fields', () => {
      const created = repo.create(baseInput, null);
      const updated = repo.updateContent(created.id, {
        content: 'Updated content',
        importance: 0.9,
      });
      expect(updated).toBe(true);

      const found = repo.getById(created.id)!;
      expect(found.content).toBe('Updated content');
      expect(found.importance).toBe(0.9);
      expect(found.title).toBe('Tech stack'); // unchanged
    });

    it('should update FTS5 via trigger', () => {
      const input: StoreInput = {
        ...baseInput,
        content: 'The project uses PostgreSQL for storage',
      };
      const created = repo.create(input, null);
      repo.updateContent(created.id, { content: 'Now uses MongoDB instead' });

      const oldResults = db.prepare(
        "SELECT rowid FROM memories_fts WHERE memories_fts MATCH 'postgresql'"
      ).all();
      expect(oldResults).toHaveLength(0);

      const newResults = db.prepare(
        "SELECT rowid FROM memories_fts WHERE memories_fts MATCH 'mongodb'"
      ).all();
      expect(newResults).toHaveLength(1);
    });

    it('should return false for non-existent ID', () => {
      expect(repo.updateContent('nonexistent', { content: 'x' })).toBe(false);
    });
  });


  describe('incrementAccess / incrementInjection', () => {
    it('should increment access count and set last_accessed', () => {
      const created = repo.create(baseInput, null);
      expect(created.accessCount).toBe(0);

      repo.incrementAccess(created.id);
      repo.incrementAccess(created.id);

      const updated = repo.getById(created.id)!;
      expect(updated.accessCount).toBe(2);
      expect(updated.lastAccessed).toBeDefined();
    });

    it('should increment injection count', () => {
      const created = repo.create(baseInput, null);
      repo.incrementInjection(created.id);
      repo.incrementInjection(created.id);
      repo.incrementInjection(created.id);
      expect(repo.getById(created.id)!.injectionCount).toBe(3);
    });
  });

  describe('delete', () => {
    it('should soft-delete by setting importance to 0', () => {
      const created = repo.create(baseInput, null);
      repo.softDelete(created.id);
      expect(repo.getById(created.id)!.importance).toBe(0);
    });

    it('should hard-delete and remove from indexes', () => {
      const created = repo.create(baseInput, null);

      expect(repo.hardDelete(created.id)).toBe(true);
      expect(repo.getById(created.id)).toBeUndefined();
    });

    it('should remove FTS5 entries on hard delete', () => {
      const created = repo.create(baseInput, null);
      repo.hardDelete(created.id);

      const ftsResults = db.prepare(
        "SELECT rowid FROM memories_fts WHERE memories_fts MATCH 'typescript'"
      ).all();
      expect(ftsResults).toHaveLength(0);
    });

    it('should write a tombstone when hard-deleting', () => {
      const created = repo.create({ ...baseInput, project: 'proj-x' });

      repo.hardDelete(created.id);
      const ts = repo.getTombstone(created.id);
      expect(ts).not.toBeNull();
      expect(ts!.id).toBe(created.id);
      expect(ts!.project).toBe('proj-x');
      expect(new Date(ts!.deletedAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe('deleteByType', () => {
    it('should delete all memories of a type', () => {
      repo.create({ ...baseInput, type: 'working', content: 'temp 1' });
      repo.create({ ...baseInput, type: 'working', content: 'temp 2' });
      repo.create({ ...baseInput, type: 'semantic', content: 'keep me' });

      const deleted = repo.deleteByType('working');
      expect(deleted).toBe(2);
      expect(repo.count()).toBe(1);
    });

    it('should write tombstones for every deleted memory', () => {
      const a = repo.create({ ...baseInput, type: 'working', content: 'a' });
      const b = repo.create({ ...baseInput, type: 'working', content: 'b' });
      repo.create({ ...baseInput, type: 'semantic', content: 'keep me' });

      repo.deleteByType('working');
      expect(repo.getTombstone(a.id)).not.toBeNull();
      expect(repo.getTombstone(b.id)).not.toBeNull();
      expect(repo.getAllTombstones()).toHaveLength(2);
    });
  });

  describe('deleteByProject', () => {
    it('should write tombstones for every memory in the project', () => {
      const a = repo.create({ ...baseInput, content: 'a', project: 'doomed' });
      const b = repo.create({ ...baseInput, content: 'b', project: 'doomed' });
      const c = repo.create({ ...baseInput, content: 'c', project: 'safe' });

      const deleted = repo.deleteByProject('doomed');
      expect(deleted).toBe(2);
      expect(repo.getTombstone(a.id)?.project).toBe('doomed');
      expect(repo.getTombstone(b.id)?.project).toBe('doomed');
      expect(repo.getTombstone(c.id)).toBeNull();
    });
  });

  describe('count / countByType', () => {
    it('should count all memories', () => {
      expect(repo.count()).toBe(0);
      repo.create(baseInput, null);
      expect(repo.count()).toBe(1);
    });

    it('should count by type', () => {
      repo.create({ ...baseInput, type: 'semantic' });
      repo.create({ ...baseInput, type: 'episodic', content: 'event' });
      repo.create({ ...baseInput, type: 'semantic', content: 'fact' });

      const counts = repo.countByType();
      expect(counts['semantic']).toBe(2);
      expect(counts['episodic']).toBe(1);
    });
  });

  describe('CHECK constraints', () => {
    it('should reject invalid memory type', () => {
      expect(() => {
        db.prepare(
          "INSERT INTO memories (id, type, content, tags) VALUES ('x', 'invalid', 'test', '[]')"
        ).run();
      }).toThrow();
    });

    it('should reject importance out of range', () => {
      expect(() => {
        db.prepare(
          "INSERT INTO memories (id, type, content, tags, importance) VALUES ('x', 'semantic', 'test', '[]', 1.5)"
        ).run();
      }).toThrow();
    });

    it('should reject negative access_count', () => {
      expect(() => {
        db.prepare(
          "INSERT INTO memories (id, type, content, tags, access_count) VALUES ('x', 'semantic', 'test', '[]', -1)"
        ).run();
      }).toThrow();
    });

    it('should reject invalid relation type', () => {
      const m1 = repo.create(baseInput, null);
      const m2 = repo.create({ ...baseInput, content: 'other' });
      expect(() => {
        db.prepare(
          "INSERT INTO relations (source_id, target_id, relation_type) VALUES (?, ?, 'invalid')"
        ).run(m1.id, m2.id);
      }).toThrow();
    });

    it('should reject invalid source', () => {
      expect(() => {
        db.prepare(
          "INSERT INTO memories (id, type, content, tags, source) VALUES ('x', 'semantic', 'test', '[]', 'invalid')"
        ).run();
      }).toThrow();
    });
  });
});

describe('content_hash scoped per project (WP-046)', () => {
  it('stores identical content in two different projects', () => {
    const db = createTestDb();
    const repo = new MemoryRepo(db);
    const input = { type: 'semantic' as const, content: 'use pnpm not npm', tags: [], importance: 0.5, source: 'manual' as const };
    const a = repo.create({ ...input, project: 'project-a' });
    const b = repo.create({ ...input, project: 'project-b' });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });

  it('still dedupes identical content within the same project', () => {
    const db = createTestDb();
    const repo = new MemoryRepo(db);
    const input = { type: 'semantic' as const, content: 'dedupe me please', tags: [], importance: 0.5, source: 'manual' as const, project: 'same-proj' };
    expect(repo.create(input, null)).not.toBeNull();
    expect(repo.create(input, null)).toBeNull();
  });
});

describe('base_importance anchor discipline (review Important 3)', () => {
  it('content-only update preserves the base anchor', () => {
    const db = createTestDb();
    const repo = new MemoryRepo(db);
    const m = repo.create({ type: 'semantic', content: 'original text', tags: [], importance: 0.8, source: 'manual' })!;
    db.prepare('UPDATE memories SET importance = 0.62 WHERE id = ?').run(m.id); // simulate decay
    repo.updateContent(m.id, { content: "fixed a typo" });
    expect(repo.getById(m.id)!.baseImportance).toBeCloseTo(0.8, 6);
  });

  it('explicit importance update re-anchors the base', () => {
    const db = createTestDb();
    const repo = new MemoryRepo(db);
    const m = repo.create({ type: 'semantic', content: 'rate me again', tags: [], importance: 0.4, source: 'manual' })!;
    repo.updateContent(m.id, { importance: 0.9 });
    const after = repo.getById(m.id)!;
    expect(after.importance).toBeCloseTo(0.9, 6);
    expect(after.baseImportance).toBeCloseTo(0.9, 6);
  });
});
