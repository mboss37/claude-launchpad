import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, closeDatabase } from './fixtures/test-db.js';
import { MemoryRepo } from '../../src/commands/memory/storage/memory-repo.js';
import { RelationRepo } from '../../src/commands/memory/storage/relation-repo.js';
import type Database from 'better-sqlite3';
import type { StoreInput } from '../../src/commands/memory/types.js';

describe('RelationRepo', () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepo;
  let relationRepo: RelationRepo;

  const baseInput: StoreInput = {
    type: 'semantic',
    content: 'Test memory',
    tags: [],
    importance: 0.5,
    source: 'manual',
  };

  beforeEach(() => {
    db = createTestDb();
    memoryRepo = new MemoryRepo(db);
    relationRepo = new RelationRepo(db);
  });

  afterEach(() => {
    closeDatabase(db);
  });

  describe('create', () => {
    it('should create a relation between two memories', () => {
      const m1 = memoryRepo.create({ ...baseInput, content: 'Memory A' }, null);
      const m2 = memoryRepo.create({ ...baseInput, content: 'Memory B' }, null);

      const created = relationRepo.create(m1.id, m2.id, 'relates_to');
      expect(created).toBe(true);
    });

    it('should ignore duplicate relations (OR IGNORE)', () => {
      const m1 = memoryRepo.create({ ...baseInput, content: 'A' }, null);
      const m2 = memoryRepo.create({ ...baseInput, content: 'B' }, null);

      relationRepo.create(m1.id, m2.id, 'relates_to');
      const duplicate = relationRepo.create(m1.id, m2.id, 'relates_to');
      expect(duplicate).toBe(false); // no changes
    });

    it('should allow different relation types between same memories', () => {
      const m1 = memoryRepo.create({ ...baseInput, content: 'A' }, null);
      const m2 = memoryRepo.create({ ...baseInput, content: 'B' }, null);

      relationRepo.create(m1.id, m2.id, 'relates_to');
      relationRepo.create(m1.id, m2.id, 'extends');

      const relations = relationRepo.getByMemory(m1.id);
      expect(relations).toHaveLength(2);
    });
  });

  describe('getBySource / getByTarget / getByMemory', () => {
    it('should retrieve relations by source', () => {
      const m1 = memoryRepo.create({ ...baseInput, content: 'Source' }, null);
      const m2 = memoryRepo.create({ ...baseInput, content: 'Target 1' }, null);
      const m3 = memoryRepo.create({ ...baseInput, content: 'Target 2' }, null);

      relationRepo.create(m1.id, m2.id, 'depends_on');
      relationRepo.create(m1.id, m3.id, 'relates_to');

      const fromSource = relationRepo.getBySource(m1.id);
      expect(fromSource).toHaveLength(2);
    });

    it('should retrieve relations by target', () => {
      const m1 = memoryRepo.create({ ...baseInput, content: 'A' }, null);
      const m2 = memoryRepo.create({ ...baseInput, content: 'B' }, null);
      const m3 = memoryRepo.create({ ...baseInput, content: 'C' }, null);

      relationRepo.create(m1.id, m3.id, 'extends');
      relationRepo.create(m2.id, m3.id, 'extends');

      const toTarget = relationRepo.getByTarget(m3.id);
      expect(toTarget).toHaveLength(2);
    });

    it('should retrieve all relations for a memory (both directions)', () => {
      const m1 = memoryRepo.create({ ...baseInput, content: 'Center' }, null);
      const m2 = memoryRepo.create({ ...baseInput, content: 'Left' }, null);
      const m3 = memoryRepo.create({ ...baseInput, content: 'Right' }, null);

      relationRepo.create(m1.id, m2.id, 'relates_to');
      relationRepo.create(m3.id, m1.id, 'depends_on');

      const all = relationRepo.getByMemory(m1.id);
      expect(all).toHaveLength(2);
    });
  });

  describe('delete', () => {
    it('should delete a specific relation', () => {
      const m1 = memoryRepo.create({ ...baseInput, content: 'A' }, null);
      const m2 = memoryRepo.create({ ...baseInput, content: 'B' }, null);

      relationRepo.create(m1.id, m2.id, 'relates_to');
      const deleted = relationRepo.delete(m1.id, m2.id, 'relates_to');
      expect(deleted).toBe(true);
      expect(relationRepo.getByMemory(m1.id)).toHaveLength(0);
    });

    it('should return false for non-existent relation', () => {
      expect(relationRepo.delete('a', 'b', 'relates_to')).toBe(false);
    });
  });

  describe('cascade delete', () => {
    it('should delete relations when memory is deleted', () => {
      const m1 = memoryRepo.create({ ...baseInput, content: 'A' }, null);
      const m2 = memoryRepo.create({ ...baseInput, content: 'B' }, null);

      relationRepo.create(m1.id, m2.id, 'relates_to');
      expect(relationRepo.count()).toBe(1);

      memoryRepo.hardDelete(m1.id);
      expect(relationRepo.count()).toBe(0);
    });
  });

  describe('countByMemory / count', () => {
    it('should count relations for a specific memory', () => {
      const m1 = memoryRepo.create({ ...baseInput, content: 'A' }, null);
      const m2 = memoryRepo.create({ ...baseInput, content: 'B' }, null);
      const m3 = memoryRepo.create({ ...baseInput, content: 'C' }, null);

      relationRepo.create(m1.id, m2.id, 'relates_to');
      relationRepo.create(m1.id, m3.id, 'extends');

      expect(relationRepo.countByMemory(m1.id)).toBe(2);
      expect(relationRepo.countByMemory(m2.id)).toBe(1);
    });

    it('should count total relations', () => {
      const m1 = memoryRepo.create({ ...baseInput, content: 'A' }, null);
      const m2 = memoryRepo.create({ ...baseInput, content: 'B' }, null);

      expect(relationRepo.count()).toBe(0);
      relationRepo.create(m1.id, m2.id, 'relates_to');
      expect(relationRepo.count()).toBe(1);
    });
  });
});
