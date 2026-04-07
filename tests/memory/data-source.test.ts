import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, closeDatabase } from './fixtures/test-db.js';
import { MemoryRepo } from '../../src/commands/memory/storage/memory-repo.js';
import { RelationRepo } from '../../src/commands/memory/storage/relation-repo.js';
import { SearchRepo } from '../../src/commands/memory/storage/search-repo.js';
import { DashboardDataSource } from '../../src/commands/memory/dashboard/data/data-source.js';
import type Database from 'better-sqlite3';
import type { StoreInput } from '../../src/commands/memory/types.js';

describe('DashboardDataSource', () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepo;
  let ds: DashboardDataSource;

  beforeEach(() => {
    db = createTestDb();
    memoryRepo = new MemoryRepo(db);
    const relationRepo = new RelationRepo(db);
    const searchRepo = new SearchRepo(db);
    ds = new DashboardDataSource(memoryRepo, relationRepo, searchRepo, '/tmp');
  });

  afterEach(() => {
    ds.stopWatching();
    closeDatabase(db);
  });

  const make = (overrides: Partial<StoreInput> = {}): StoreInput => ({
    type: 'semantic',
    content: 'test content',
    title: 'test',
    tags: ['test'],
    importance: 0.7,
    source: 'manual',
    project: 'proj-a',
    ...overrides,
  });

  describe('deleteMemory', () => {
    it('should delete a single memory and return true', () => {
      const m = memoryRepo.create(make());
      ds.refresh();

      expect(ds.deleteMemory(m.id)).toBe(true);
      ds.refresh();
      expect(ds.getMemories()).toHaveLength(0);
    });

    it('should return false for nonexistent memory', () => {
      expect(ds.deleteMemory('nonexistent-id')).toBe(false);
    });

    it('should only delete the targeted memory', () => {
      memoryRepo.create(make({ content: 'keep me' }));
      const toDelete = memoryRepo.create(make({ content: 'delete me' }));
      ds.refresh();

      ds.deleteMemory(toDelete.id);
      ds.refresh();

      const remaining = ds.getMemories();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.content).toBe('keep me');
    });
  });

  describe('purgeProject', () => {
    it('should delete all memories for a project and return count', () => {
      memoryRepo.create(make({ content: 'a1' }));
      memoryRepo.create(make({ content: 'a2' }));
      memoryRepo.create(make({ content: 'b1', project: 'proj-b' }));

      const deleted = ds.purgeProject('proj-a');
      expect(deleted).toBe(2);

      ds.refresh();
      expect(ds.getMemories()).toHaveLength(1);
      expect(ds.getMemories()[0]!.content).toBe('b1');
    });

    it('should return 0 for nonexistent project', () => {
      expect(ds.purgeProject('no-such-project')).toBe(0);
    });

    it('should remove project from getProjects list', () => {
      memoryRepo.create(make());
      memoryRepo.create(make({ content: 'other', project: 'proj-b' }));
      ds.refresh();
      expect(ds.getProjects()).toContain('proj-a');

      ds.purgeProject('proj-a');
      ds.refresh();
      expect(ds.getProjects()).not.toContain('proj-a');
      expect(ds.getProjects()).toContain('proj-b');
    });
  });

  describe('getMemories filtering after mutations', () => {
    it('should reflect deletions in type filter', () => {
      memoryRepo.create(make({ type: 'semantic', content: 's1' }));
      memoryRepo.create(make({ type: 'procedural', content: 'p1' }));
      ds.refresh();

      ds.purgeProject('proj-a');
      ds.refresh();

      expect(ds.getMemories({ type: 'semantic' })).toHaveLength(0);
      expect(ds.getMemories({ type: 'procedural' })).toHaveLength(0);
    });

    it('should reflect deletions in project filter', () => {
      memoryRepo.create(make());
      memoryRepo.create(make({ content: 'other', project: 'proj-b' }));
      ds.refresh();

      ds.purgeProject('proj-a');
      ds.refresh();

      expect(ds.getMemories({ project: 'proj-a' })).toHaveLength(0);
      expect(ds.getMemories({ project: 'proj-b' })).toHaveLength(1);
    });
  });

  describe('getStats after mutations', () => {
    it('should reflect purge in total count', () => {
      memoryRepo.create(make({ content: 'a' }));
      memoryRepo.create(make({ content: 'b' }));
      memoryRepo.create(make({ content: 'c', project: 'proj-b' }));
      ds.refresh();

      ds.purgeProject('proj-a');
      ds.refresh();

      const stats = ds.getStats();
      expect(stats.total).toBe(1);
      expect(stats.byProject['proj-a']).toBeUndefined();
      expect(stats.byProject['proj-b']).toBe(1);
    });
  });

  describe('soft-deleted memories excluded', () => {
    it('should not include importance=0 memories after refresh', () => {
      const m = memoryRepo.create(make());
      memoryRepo.softDelete(m.id);
      ds.refresh();

      expect(ds.getMemories()).toHaveLength(0);
    });
  });
});
