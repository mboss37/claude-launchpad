import { describe, it, expect } from 'vitest';
import { createTestDb } from '../fixtures/test-db.js';
import { MemoryRepo } from '../../../src/commands/memory/storage/memory-repo.js';
import { RelationRepo } from '../../../src/commands/memory/storage/relation-repo.js';
import { ConsolidationService } from '../../../src/commands/memory/services/consolidation-service.js';

function setup() {
  const db = createTestDb();
  const memoryRepo = new MemoryRepo(db);
  const relationRepo = new RelationRepo(db);
  const consolidation = new ConsolidationService({ memoryRepo, relationRepo });
  return { db, memoryRepo, relationRepo, consolidation };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('ConsolidationService', () => {
  describe('deduplicateMemories', () => {
    it('merges memories with identical content', () => {
      const { db, memoryRepo, consolidation } = setup();

      memoryRepo.create({
        type: 'semantic', content: 'SQLite uses WAL mode', tags: ['tag1'],
        importance: 0.8, source: 'manual',
      }, null);

      // Insert duplicate directly to bypass content_hash unique constraint
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO memories (id, type, content, tags, importance, source, created_at, updated_at, content_hash)
        VALUES (?, 'semantic', 'SQLite uses WAL mode', '["tag2"]', 0.6, 'manual', ?, ?, 'dup-hash')
      `).run('dup-id', now, now);

      expect(memoryRepo.count()).toBe(2);
      const merged = consolidation.deduplicateMemories();
      expect(merged).toBe(1);
      expect(memoryRepo.count()).toBe(1);
    });

    it('preserves memories with different content', () => {
      const { memoryRepo, consolidation } = setup();

      memoryRepo.create({
        type: 'semantic', content: 'topic alpha about databases', tags: [],
        importance: 0.5, source: 'manual',
      }, null);

      memoryRepo.create({
        type: 'semantic', content: 'topic beta about networking', tags: [],
        importance: 0.5, source: 'manual',
      }, null);

      const merged = consolidation.deduplicateMemories();
      expect(merged).toBe(0);
      expect(memoryRepo.count()).toBe(2);
    });
  });

  describe('compressEpisodics', () => {
    it('removes old consolidated episodic memories', () => {
      const { memoryRepo, relationRepo, consolidation } = setup();

      const episodic = memoryRepo.create({
        type: 'episodic', content: 'old observation', tags: [],
        importance: 0.1, source: 'manual',
      }, null);

      const pattern = memoryRepo.create({
        type: 'pattern', content: 'derived pattern', tags: [],
        importance: 0.7, source: 'consolidation',
      }, null);

      relationRepo.create(episodic.id, pattern.id, 'derived_from');

      const db = (memoryRepo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare('UPDATE memories SET created_at = ? WHERE id = ?').run(daysAgo(90), episodic.id);

      const compressed = consolidation.compressEpisodics();
      expect(compressed).toBe(1);
      expect(memoryRepo.getById(episodic.id)).toBeUndefined();
      expect(memoryRepo.getById(pattern.id)).toBeDefined();
    });

    it('preserves recent episodic memories', () => {
      const { memoryRepo, relationRepo, consolidation } = setup();

      const episodic = memoryRepo.create({
        type: 'episodic', content: 'recent observation', tags: [],
        importance: 0.1, source: 'manual',
      }, null);

      const pattern = memoryRepo.create({
        type: 'pattern', content: 'derived pattern', tags: [],
        importance: 0.7, source: 'consolidation',
      }, null);

      relationRepo.create(episodic.id, pattern.id, 'derived_from');

      const compressed = consolidation.compressEpisodics();
      expect(compressed).toBe(0);
    });
  });

  describe('prune', () => {
    it('deletes old low-importance unaccessed memories', () => {
      const { memoryRepo, consolidation } = setup();

      const memory = memoryRepo.create({
        type: 'semantic', content: 'ancient forgotten fact', tags: [],
        importance: 0.05, source: 'manual',
      }, null);

      const db = (memoryRepo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare('UPDATE memories SET created_at = ? WHERE id = ?').run(daysAgo(100), memory.id);

      const pruned = consolidation.prune();
      expect(pruned).toBe(1);
    });

    it('preserves important memories regardless of age', () => {
      const { memoryRepo, consolidation } = setup();

      const memory = memoryRepo.create({
        type: 'semantic', content: 'important old fact', tags: [],
        importance: 0.5, source: 'manual',
      }, null);

      const db = (memoryRepo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare('UPDATE memories SET created_at = ? WHERE id = ?').run(daysAgo(200), memory.id);

      const pruned = consolidation.prune();
      expect(pruned).toBe(0);
    });
  });

  describe('consolidate', () => {
    it('runs full pipeline without errors', async () => {
      const { memoryRepo, consolidation } = setup();

      memoryRepo.create({
        type: 'semantic', content: 'test memory', tags: [],
        importance: 0.5, source: 'manual',
      }, null);

      const report = await consolidation.consolidate();
      expect(report).toHaveProperty('deduplicated');
      expect(report).toHaveProperty('episodicsCompressed');
      expect(report).toHaveProperty('pruned');
    });
  });
});
