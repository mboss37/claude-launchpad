import { describe, it, expect } from 'vitest';
import { createTestDb } from './fixtures/test-db.js';
import { MemoryRepo } from '../../src/commands/memory/storage/memory-repo.js';
import { RelationRepo } from '../../src/commands/memory/storage/relation-repo.js';

describe('deleteByProject', () => {
  it('deletes all memories for a specific project', () => {
    const db = createTestDb();
    const repo = new MemoryRepo(db);

    repo.create({ type: 'semantic', content: 'proj-a memory', tags: [], importance: 0.5, source: 'manual', project: 'proj-a' }, null);
    repo.create({ type: 'semantic', content: 'proj-a second', tags: [], importance: 0.5, source: 'manual', project: 'proj-a' }, null);
    repo.create({ type: 'semantic', content: 'proj-b memory', tags: [], importance: 0.5, source: 'manual', project: 'proj-b' }, null);

    const deleted = repo.deleteByProject('proj-a');

    expect(deleted).toBe(2);
    expect(repo.count('proj-a')).toBe(0);
    expect(repo.count('proj-b')).toBe(1);
  });

  it('returns 0 when project has no memories', () => {
    const db = createTestDb();
    const repo = new MemoryRepo(db);

    const deleted = repo.deleteByProject('nonexistent');
    expect(deleted).toBe(0);
  });
});

describe('deleteOrphaned', () => {
  it('relations are cascade-deleted when memories are removed', () => {
    const db = createTestDb();
    const memoryRepo = new MemoryRepo(db);
    const relationRepo = new RelationRepo(db);

    const a = memoryRepo.create({ type: 'semantic', content: 'mem a', tags: [], importance: 0.5, source: 'manual', project: 'proj-a' }, null);
    const b = memoryRepo.create({ type: 'semantic', content: 'mem b', tags: [], importance: 0.5, source: 'manual', project: 'proj-a' }, null);
    const c = memoryRepo.create({ type: 'semantic', content: 'mem c', tags: [], importance: 0.5, source: 'manual', project: 'proj-b' }, null);

    relationRepo.create(a.id, b.id, 'relates_to');
    relationRepo.create(a.id, c.id, 'depends_on');
    relationRepo.create(c.id, b.id, 'extends');
    expect(relationRepo.count()).toBe(3);

    // ON DELETE CASCADE handles cleanup automatically
    memoryRepo.deleteByProject('proj-a');
    expect(relationRepo.count()).toBe(0);

    // deleteOrphaned is a safety net — returns 0 when cascade did its job
    const orphaned = relationRepo.deleteOrphaned();
    expect(orphaned).toBe(0);
  });

  it('preserves relations between surviving memories', () => {
    const db = createTestDb();
    const memoryRepo = new MemoryRepo(db);
    const relationRepo = new RelationRepo(db);

    const a = memoryRepo.create({ type: 'semantic', content: 'mem a', tags: [], importance: 0.5, source: 'manual', project: 'proj-a' }, null);
    const b = memoryRepo.create({ type: 'semantic', content: 'mem b', tags: [], importance: 0.5, source: 'manual', project: 'proj-b' }, null);
    const c = memoryRepo.create({ type: 'semantic', content: 'mem c', tags: [], importance: 0.5, source: 'manual', project: 'proj-b' }, null);

    relationRepo.create(a.id, b.id, 'relates_to');
    relationRepo.create(b.id, c.id, 'extends');

    memoryRepo.deleteByProject('proj-a');

    // a→b relation cascaded away, b→c survives
    expect(relationRepo.count()).toBe(1);
    expect(relationRepo.getByMemory(b.id)).toHaveLength(1);
  });
});
