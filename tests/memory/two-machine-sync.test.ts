import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, closeDatabase } from './fixtures/test-db.js';
import { MemoryRepo } from '../../src/commands/memory/storage/memory-repo.js';
import { RelationRepo } from '../../src/commands/memory/storage/relation-repo.js';
import { mergeFromRemote, memoryToSyncRow, tombstoneToSyncRow } from '../../src/commands/memory/utils/sync-merge.js';
import type Database from 'better-sqlite3';
import type { SyncPayload } from '../../src/commands/memory/types.js';

/**
 * Simulates two machines sharing a project via the sync payload.
 * This is the invariant the user asked for:
 *   "machines must have always the same memories — never more, never less".
 */

interface Machine {
  readonly db: Database.Database;
  readonly memoryRepo: MemoryRepo;
  readonly relationRepo: RelationRepo;
}

function setupMachine(): Machine {
  const db = createTestDb();
  return { db, memoryRepo: new MemoryRepo(db), relationRepo: new RelationRepo(db) };
}

function buildPayload(m: Machine, project: string): SyncPayload {
  const memories = m.memoryRepo.getAllForSync(project);
  const tombstones = m.memoryRepo.getTombstonesByProject(project);
  const memIds = new Set(memories.map((x) => x.id));
  const relations = m.relationRepo.getAll().filter(
    (r) => memIds.has(r.sourceId) && memIds.has(r.targetId),
  );
  return {
    version: 2,
    machine_id: 'test',
    pushed_at: new Date().toISOString(),
    memories: memories.map(memoryToSyncRow),
    relations: relations.map((r) => ({
      source_id: r.sourceId,
      target_id: r.targetId,
      relation_type: r.relationType,
      created_at: r.createdAt,
    })),
    tombstones: tombstones.map(tombstoneToSyncRow),
  };
}

/**
 * Two-way sync: simulate pull-before-push on both sides so both machines
 * end up at the same merged state.
 */
function syncBothWays(a: Machine, b: Machine, project: string): void {
  // A pulls from B, uploads the merged result
  const bPayload = buildPayload(b, project);
  mergeFromRemote(a.memoryRepo, a.relationRepo, bPayload);

  // B pulls from A's (now merged) state
  const aPayload = buildPayload(a, project);
  mergeFromRemote(b.memoryRepo, b.relationRepo, aPayload);
}

function idsByProject(m: Machine, project: string): string[] {
  return [...m.memoryRepo.getAllForSync(project).map((x) => x.id)].sort();
}

describe('two-machine sync parity', () => {
  let machineA: Machine;
  let machineB: Machine;

  beforeEach(() => {
    machineA = setupMachine();
    machineB = setupMachine();
  });

  afterEach(() => {
    closeDatabase(machineA.db);
    closeDatabase(machineB.db);
  });

  it('both machines converge on the same memory set after sync', () => {
    for (let i = 0; i < 5; i++) {
      machineA.memoryRepo.create({
        type: 'semantic',
        content: `memory ${i} on A`,
        title: `mem-${i}`,
        tags: [],
        importance: 0.5,
        source: 'manual',
        project: 'proj',
      });
    }

    syncBothWays(machineA, machineB, 'proj');

    expect(idsByProject(machineA, 'proj')).toEqual(idsByProject(machineB, 'proj'));
    expect(machineA.memoryRepo.getAllForSync('proj')).toHaveLength(5);
    expect(machineB.memoryRepo.getAllForSync('proj')).toHaveLength(5);
  });

  it('deletions on machine A propagate to machine B on next sync', () => {
    for (let i = 0; i < 5; i++) {
      machineA.memoryRepo.create({
        type: 'semantic',
        content: `memory ${i}`,
        title: `mem-${i}`,
        tags: [],
        importance: 0.5,
        source: 'manual',
        project: 'proj',
      });
    }
    syncBothWays(machineA, machineB, 'proj');
    expect(machineB.memoryRepo.getAllForSync('proj')).toHaveLength(5);

    const ids = machineA.memoryRepo.getAllForSync('proj').map((m) => m.id);
    for (const id of ids.slice(0, 3)) {
      machineA.memoryRepo.hardDelete(id);
    }
    expect(machineA.memoryRepo.getAllForSync('proj')).toHaveLength(2);

    syncBothWays(machineA, machineB, 'proj');

    expect(idsByProject(machineA, 'proj')).toEqual(idsByProject(machineB, 'proj'));
    expect(machineA.memoryRepo.getAllForSync('proj')).toHaveLength(2);
    expect(machineB.memoryRepo.getAllForSync('proj')).toHaveLength(2);
  });

  it('push alone never resurrects a hard-deleted memory (the original bug)', () => {
    machineA.memoryRepo.create({
      type: 'semantic',
      content: 'please stay dead',
      tags: [],
      importance: 0.5,
      source: 'manual',
      project: 'proj',
    });
    syncBothWays(machineA, machineB, 'proj');
    expect(machineB.memoryRepo.getAllForSync('proj')).toHaveLength(1);

    const id = machineA.memoryRepo.getAllForSync('proj')[0]!.id;
    machineA.memoryRepo.hardDelete(id);
    expect(machineA.memoryRepo.getAllForSync('proj')).toHaveLength(0);

    // Simulate pull-before-push from B's state (which still has the memory),
    // then push back — previously this would resurrect the memory.
    syncBothWays(machineA, machineB, 'proj');

    expect(machineA.memoryRepo.getAllForSync('proj')).toHaveLength(0);
    expect(machineB.memoryRepo.getAllForSync('proj')).toHaveLength(0);
  });

  it('delete on one machine and update on the other: most recent wins', () => {
    machineA.memoryRepo.create({
      type: 'semantic',
      content: 'original',
      title: 'shared',
      tags: [],
      importance: 0.5,
      source: 'manual',
      project: 'proj',
    });
    syncBothWays(machineA, machineB, 'proj');

    const id = machineA.memoryRepo.getAllForSync('proj')[0]!.id;

    // B deletes at T1
    machineB.memoryRepo.hardDelete(id);
    const tombstone = machineB.memoryRepo.getTombstone(id)!;

    // A updates at T2 > T1
    const later = new Date(new Date(tombstone.deletedAt).getTime() + 60_000).toISOString();
    machineA.db.prepare('UPDATE memories SET content = ?, updated_at = ? WHERE id = ?')
      .run('revived content', later, id);

    syncBothWays(machineA, machineB, 'proj');

    expect(machineA.memoryRepo.getAllForSync('proj')).toHaveLength(1);
    expect(machineB.memoryRepo.getAllForSync('proj')).toHaveLength(1);
    expect(machineA.memoryRepo.getById(id)?.content).toBe('revived content');
    expect(machineB.memoryRepo.getById(id)?.content).toBe('revived content');
  });

  it('bulk project purge on one machine propagates', () => {
    for (let i = 0; i < 4; i++) {
      machineA.memoryRepo.create({
        type: 'semantic',
        content: `doomed ${i}`,
        tags: [],
        importance: 0.5,
        source: 'manual',
        project: 'doomed',
      });
    }
    syncBothWays(machineA, machineB, 'doomed');
    expect(machineB.memoryRepo.getAllForSync('doomed')).toHaveLength(4);

    machineA.memoryRepo.deleteByProject('doomed');
    expect(machineA.memoryRepo.getAllForSync('doomed')).toHaveLength(0);

    syncBothWays(machineA, machineB, 'doomed');

    expect(machineB.memoryRepo.getAllForSync('doomed')).toHaveLength(0);
    expect(idsByProject(machineA, 'doomed')).toEqual(idsByProject(machineB, 'doomed'));
  });
});
