import { describe, it, expect } from 'vitest';
import { createTestDb } from '../fixtures/test-db.js';
import { MemoryRepo } from '../../../src/commands/memory/storage/memory-repo.js';
import { RelationRepo } from '../../../src/commands/memory/storage/relation-repo.js';
import { DecayService } from '../../../src/commands/memory/services/decay-service.js';
import { DEFAULT_DECAY_PARAMS } from '../../../src/commands/memory/config.js';

function setup() {
  const db = createTestDb();
  const memoryRepo = new MemoryRepo(db);
  const relationRepo = new RelationRepo(db);
  const decayService = new DecayService({ memoryRepo, relationRepo });
  return { db, memoryRepo, relationRepo, decayService };
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('DecayService', () => {
  describe('clearWorkingMemories', () => {
    it('deletes all working-type memories', () => {
      const { memoryRepo, decayService } = setup();

      memoryRepo.create({ type: 'working', content: 'temp note', tags: [], importance: 0.5, source: 'manual' }, null);
      memoryRepo.create({ type: 'working', content: 'another temp', tags: [], importance: 0.5, source: 'manual' }, null);
      memoryRepo.create({ type: 'semantic', content: 'permanent', tags: [], importance: 0.5, source: 'manual' }, null);

      const cleared = decayService.clearWorkingMemories();

      expect(cleared).toBe(2);
      expect(memoryRepo.count()).toBe(1);
    });
  });

  describe('computeDecayedImportance', () => {
    it('returns same importance for memories within 7-day consolidation window (non-episodic)', () => {
      const { memoryRepo, decayService } = setup();

      const memory = memoryRepo.create({
        type: 'semantic',
        content: 'fresh semantic memory',
        tags: [],
        importance: 0.8,
        source: 'manual',
      }, null);

      const result = decayService.computeDecayedImportance(memory);
      expect(result).toBe(0.8);
    });

    it('applies Ebbinghaus decay to episodic memories within 7 days', () => {
      const { memoryRepo, relationRepo } = setup();
      const decayService = new DecayService({ memoryRepo, relationRepo });

      const memory = memoryRepo.create({
        type: 'episodic',
        content: 'something happened',
        tags: [],
        importance: 0.8,
        source: 'manual',
      }, null);

      const threeDaysAgo = daysAgo(3);
      memoryRepo.updateContent(memory.id, { content: memory.content });
      const db = (memoryRepo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?').run(threeDaysAgo, threeDaysAgo, memory.id);

      const updated = memoryRepo.getById(memory.id)!;
      const result = decayService.computeDecayedImportance(updated);

      expect(result).toBeGreaterThan(0.2);
      expect(result).toBeLessThan(0.4);
    });

    it('applies exponential decay for memories older than 7 days', () => {
      const { memoryRepo, relationRepo } = setup();
      const decayService = new DecayService({ memoryRepo, relationRepo });

      const memory = memoryRepo.create({
        type: 'semantic',
        content: 'old semantic fact',
        tags: [],
        importance: 0.8,
        source: 'manual',
      }, null);

      const db = (memoryRepo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?').run(daysAgo(30), daysAgo(30), memory.id);

      const updated = memoryRepo.getById(memory.id)!;
      const result = decayService.computeDecayedImportance(updated);

      expect(result).toBeGreaterThan(0.7);
      expect(result).toBeLessThan(0.8);
    });

    it('never drops below importance floor', () => {
      const { memoryRepo, relationRepo } = setup();
      const decayService = new DecayService({ memoryRepo, relationRepo });

      const memory = memoryRepo.create({
        type: 'episodic',
        content: 'ancient episodic',
        tags: [],
        importance: 0.1,
        source: 'manual',
      }, null);

      const db = (memoryRepo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?').run(daysAgo(500), daysAgo(500), memory.id);

      const updated = memoryRepo.getById(memory.id)!;
      const result = decayService.computeDecayedImportance(updated);

      expect(result).toBeGreaterThanOrEqual(DEFAULT_DECAY_PARAMS.importanceFloor);
    });

    it('applies injection penalty for surfaced-but-unused memories', () => {
      const { memoryRepo, relationRepo } = setup();
      const decayService = new DecayService({ memoryRepo, relationRepo });

      const memory = memoryRepo.create({
        type: 'semantic',
        content: 'frequently injected',
        tags: [],
        importance: 0.5,
        source: 'manual',
      }, null);

      for (let i = 0; i < 6; i++) {
        memoryRepo.incrementInjection(memory.id);
      }

      const db = (memoryRepo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?').run(daysAgo(30), daysAgo(30), memory.id);

      const updated = memoryRepo.getById(memory.id)!;
      const withPenalty = decayService.computeDecayedImportance(updated);

      db.prepare('UPDATE memories SET injection_count = 0 WHERE id = ?').run(memory.id);
      const noPenalty = decayService.computeDecayedImportance(memoryRepo.getById(memory.id)!);

      expect(withPenalty).toBeLessThan(noPenalty);
    });

    it('connected memories decay slower than isolated ones', () => {
      const { db, memoryRepo, relationRepo, decayService } = setup();

      const isolated = memoryRepo.create(
        { type: 'semantic', content: 'isolated memory', tags: [], importance: 0.8, source: 'manual' }, null,
      );
      const connected = memoryRepo.create(
        { type: 'semantic', content: 'connected memory', tags: [], importance: 0.8, source: 'manual' }, null,
      );

      // Age both to 180 days
      const date = daysAgo(180);
      db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?').run(date, date, isolated.id);
      db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?').run(date, date, connected.id);

      // Create 7 relations to make `connected` highly connected
      for (let i = 0; i < 7; i++) {
        const other = memoryRepo.create(
          { type: 'semantic', content: `related ${i}`, tags: [], importance: 0.5, source: 'manual' }, null,
        );
        relationRepo.create(connected.id, other.id, 'relates_to');
      }

      const decayedIsolated = decayService.computeDecayedImportance(memoryRepo.getById(isolated.id)!);
      const decayedConnected = decayService.computeDecayedImportance(memoryRepo.getById(connected.id)!);

      expect(decayedConnected).toBeGreaterThan(decayedIsolated);
    });
  });

  describe('prune', () => {
    it('deletes old low-importance unaccessed memories', () => {
      const { memoryRepo, decayService } = setup();

      const memory = memoryRepo.create({
        type: 'episodic',
        content: 'should be pruned',
        tags: [],
        importance: 0.05,
        source: 'manual',
      }, null);

      memoryRepo.updateImportance(memory.id, 0.05);
      const db = (memoryRepo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare('UPDATE memories SET created_at = ? WHERE id = ?').run(daysAgo(100), memory.id);

      const pruned = decayService.prune();
      expect(pruned).toBe(1);
      expect(memoryRepo.count()).toBe(0);
    });

    it('preserves accessed memories even if old and low importance', () => {
      const { memoryRepo, decayService } = setup();

      const memory = memoryRepo.create({
        type: 'episodic',
        content: 'old but accessed',
        tags: [],
        importance: 0.05,
        source: 'manual',
      }, null);

      memoryRepo.incrementAccess(memory.id);
      memoryRepo.updateImportance(memory.id, 0.05);
      const db = (memoryRepo as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db;
      db.prepare('UPDATE memories SET created_at = ? WHERE id = ?').run(daysAgo(100), memory.id);

      const pruned = decayService.prune();
      expect(pruned).toBe(0);
      expect(memoryRepo.count()).toBe(1);
    });
  });

  describe('run', () => {
    it('executes full decay cycle', () => {
      const { memoryRepo, decayService } = setup();

      memoryRepo.create({ type: 'working', content: 'temp', tags: [], importance: 0.5, source: 'manual' }, null);
      memoryRepo.create({ type: 'semantic', content: 'keep', tags: [], importance: 0.5, source: 'manual' }, null);

      const report = decayService.run();

      expect(report.workingCleared).toBe(1);
      expect(report.decayed).toBeGreaterThanOrEqual(0);
      expect(report.pruned).toBeGreaterThanOrEqual(0);
      expect(memoryRepo.count()).toBe(1);
    });
  });
});
