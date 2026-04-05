import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, closeDatabase } from './fixtures/test-db.js';
import { MemoryRepo } from '../../src/commands/memory/storage/memory-repo.js';
import { RelationRepo } from '../../src/commands/memory/storage/relation-repo.js';
import { mergeFromRemote, memoryToSyncRow } from '../../src/commands/memory/utils/sync-merge.js';
import type Database from 'better-sqlite3';
import type { SyncPayload, SyncMemoryRow } from '../../src/commands/memory/types.js';

function makeSyncMemory(overrides: Partial<SyncMemoryRow> = {}): SyncMemoryRow {
  return {
    id: 'test-id-1',
    type: 'semantic',
    title: 'Test memory',
    content: 'Some content',
    context: null,
    source: 'manual',
    project: 'test-project',
    tags: ['#test'],
    importance: 0.5,
    access_count: 0,
    injection_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    last_accessed: null,
    ...overrides,
  };
}

function makePayload(
  memories: readonly SyncMemoryRow[] = [],
  relations: SyncPayload['relations'] = [],
): SyncPayload {
  return {
    version: 1,
    machine_id: 'test-machine',
    pushed_at: new Date().toISOString(),
    memories,
    relations,
  };
}

describe('sync-merge', () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepo;
  let relationRepo: RelationRepo;

  beforeEach(() => {
    db = createTestDb();
    memoryRepo = new MemoryRepo(db);
    relationRepo = new RelationRepo(db);
  });

  afterEach(() => {
    closeDatabase(db);
  });

  describe('mergeFromRemote', () => {
    it('should insert new memories', () => {
      const remote = makeSyncMemory({ id: 'new-1' });
      const result = mergeFromRemote(memoryRepo, relationRepo, makePayload([remote]));

      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(0);
      const stored = memoryRepo.getById('new-1');
      expect(stored).toBeDefined();
      expect(stored!.content).toBe('Some content');
      expect(stored!.project).toBe('test-project');
    });

    it('should update memory when remote is newer', () => {
      memoryRepo.create({
        type: 'semantic',
        content: 'Old content',
        title: 'Old title',
        tags: [],
        importance: 0.5,
        source: 'manual',
        project: 'test-project',
      });
      const local = memoryRepo.getAll()[0]!;

      const remote = makeSyncMemory({
        id: local.id,
        content: 'Updated content',
        title: 'Updated title',
        updated_at: '2099-01-01T00:00:00.000Z',
      });

      const result = mergeFromRemote(memoryRepo, relationRepo, makePayload([remote]));
      expect(result.updated).toBe(1);

      const after = memoryRepo.getById(local.id)!;
      expect(after.content).toBe('Updated content');
      expect(after.title).toBe('Updated title');
    });

    it('should keep local memory when local is newer', () => {
      memoryRepo.create({
        type: 'semantic',
        content: 'Local content',
        title: 'Local title',
        tags: [],
        importance: 0.5,
        source: 'manual',
        project: 'test-project',
      });
      const local = memoryRepo.getAll()[0]!;

      const remote = makeSyncMemory({
        id: local.id,
        content: 'Old remote content',
        updated_at: '2000-01-01T00:00:00.000Z',
      });

      const result = mergeFromRemote(memoryRepo, relationRepo, makePayload([remote]));
      expect(result.updated).toBe(0);

      const after = memoryRepo.getById(local.id)!;
      expect(after.content).toBe('Local content');
    });

    it('should merge all memories in payload (project filtering at file level)', () => {
      const m1 = makeSyncMemory({ id: 'proj-a', project: 'alpha' });
      const m2 = makeSyncMemory({ id: 'proj-b', project: 'beta' });

      const result = mergeFromRemote(memoryRepo, relationRepo, makePayload([m1, m2]));

      expect(result.inserted).toBe(2);
      expect(memoryRepo.getById('proj-a')).toBeDefined();
      expect(memoryRepo.getById('proj-b')).toBeDefined();
    });

    it('should merge relations when both memories exist locally', () => {
      const m1 = makeSyncMemory({ id: 'rel-a' });
      const m2 = makeSyncMemory({ id: 'rel-b' });
      const relations = [
        { source_id: 'rel-a', target_id: 'rel-b', relation_type: 'relates_to' as const, created_at: '2026-01-01T00:00:00.000Z' },
      ];

      const result = mergeFromRemote(memoryRepo, relationRepo, makePayload([m1, m2], relations));
      expect(result.relationsAdded).toBe(1);
      expect(relationRepo.count()).toBe(1);
    });

    it('should skip relations when referenced memory does not exist', () => {
      const m1 = makeSyncMemory({ id: 'exists' });
      const relations = [
        { source_id: 'exists', target_id: 'missing', relation_type: 'relates_to' as const, created_at: '2026-01-01T00:00:00.000Z' },
      ];

      const result = mergeFromRemote(memoryRepo, relationRepo, makePayload([m1], relations));
      expect(result.relationsAdded).toBe(0);
    });

    it('should handle empty payload', () => {
      const result = mergeFromRemote(memoryRepo, relationRepo, makePayload());
      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.relationsAdded).toBe(0);
    });

    it('should not duplicate relations on re-merge', () => {
      const m1 = makeSyncMemory({ id: 'dup-a' });
      const m2 = makeSyncMemory({ id: 'dup-b' });
      const relations = [
        { source_id: 'dup-a', target_id: 'dup-b', relation_type: 'relates_to' as const, created_at: '2026-01-01T00:00:00.000Z' },
      ];
      const payload = makePayload([m1, m2], relations);

      mergeFromRemote(memoryRepo, relationRepo, payload);
      const result2 = mergeFromRemote(memoryRepo, relationRepo, payload);

      expect(result2.relationsAdded).toBe(0);
      expect(relationRepo.count()).toBe(1);
    });
  });

  describe('memoryToSyncRow', () => {
    it('should convert Memory to SyncMemoryRow', () => {
      const memory = memoryRepo.create({
        type: 'procedural',
        content: 'How to deploy',
        title: 'Deploy guide',
        tags: ['#howto'],
        importance: 0.8,
        source: 'manual',
        project: 'my-project',
      });

      const row = memoryToSyncRow(memory);
      expect(row.id).toBe(memory.id);
      expect(row.type).toBe('procedural');
      expect(row.content).toBe('How to deploy');
      expect(row.title).toBe('Deploy guide');
      expect(row.tags).toEqual(['#howto']);
      expect(row.importance).toBe(0.8);
      expect(row.project).toBe('my-project');
      expect(row.access_count).toBe(0);
      expect(row.injection_count).toBe(0);
    });
  });

  describe('upsertFromSync', () => {
    it('should preserve all fields including counters', () => {
      const remote = makeSyncMemory({
        id: 'full-fields',
        access_count: 42,
        injection_count: 7,
        last_accessed: '2026-03-15T00:00:00.000Z',
      });

      memoryRepo.upsertFromSync(remote);
      const stored = memoryRepo.getById('full-fields')!;

      expect(stored.accessCount).toBe(42);
      expect(stored.injectionCount).toBe(7);
      expect(stored.lastAccessed).toBe('2026-03-15T00:00:00.000Z');
    });

    it('should overwrite existing memory', () => {
      memoryRepo.upsertFromSync(makeSyncMemory({ id: 'overwrite', content: 'v1' }));
      memoryRepo.upsertFromSync(makeSyncMemory({ id: 'overwrite', content: 'v2' }));

      const stored = memoryRepo.getById('overwrite')!;
      expect(stored.content).toBe('v2');
    });
  });

  describe('getAllForSync', () => {
    it('should return only strict project matches', () => {
      memoryRepo.create({ type: 'semantic', content: 'a', tags: [], importance: 0.5, source: 'manual', project: 'alpha' });
      memoryRepo.create({ type: 'semantic', content: 'b', tags: [], importance: 0.5, source: 'manual', project: 'beta' });
      memoryRepo.create({ type: 'semantic', content: 'c', tags: [], importance: 0.5, source: 'manual' });

      const alpha = memoryRepo.getAllForSync('alpha');
      expect(alpha).toHaveLength(1);
      expect(alpha[0]!.content).toBe('a');
    });

    it('should return all memories when no project specified', () => {
      memoryRepo.create({ type: 'semantic', content: 'a', tags: [], importance: 0.5, source: 'manual', project: 'alpha' });
      memoryRepo.create({ type: 'semantic', content: 'b', tags: [], importance: 0.5, source: 'manual' });

      const all = memoryRepo.getAllForSync();
      expect(all).toHaveLength(2);
    });
  });

  describe('RelationRepo.getAll', () => {
    it('should return all relations', () => {
      const m1 = memoryRepo.create({ type: 'semantic', content: 'a', tags: [], importance: 0.5, source: 'manual' });
      const m2 = memoryRepo.create({ type: 'semantic', content: 'b', tags: [], importance: 0.5, source: 'manual' });

      relationRepo.create(m1.id, m2.id, 'relates_to');
      const all = relationRepo.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]!.sourceId).toBe(m1.id);
      expect(all[0]!.targetId).toBe(m2.id);
    });
  });
});
