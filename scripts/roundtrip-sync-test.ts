import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MemoryRepo } from '../src/commands/memory/storage/memory-repo.js';
import { RelationRepo } from '../src/commands/memory/storage/relation-repo.js';
import { createDatabase, closeDatabase } from '../src/commands/memory/storage/database.js';
import { migrate } from '../src/commands/memory/storage/migrator.js';
import {
  createGist,
  updateGistFiles,
  readGistFile,
  projectToFilename,
} from '../src/commands/memory/utils/gist-transport.js';
import {
  memoryToSyncRow,
  tombstoneToSyncRow,
  mergeFromRemote,
  parsePayload,
} from '../src/commands/memory/utils/sync-merge.js';
import type { SyncPayload } from '../src/commands/memory/types.js';

const PROJECT = `rt-test-${Date.now()}`;
const FILENAME = projectToFilename(PROJECT);
const A_DIR = join(tmpdir(), 'rt-a');
const B_DIR = join(tmpdir(), 'rt-b');

function section(title: string): void {
  console.log(`\n── ${title} ──`);
}

function setupMachine(dir: string, label: string) {
  mkdirSync(dir, { recursive: true });
  const db = createDatabase({ dbPath: join(dir, 'memory.db') });
  migrate(db);
  const memoryRepo = new MemoryRepo(db);
  const relationRepo = new RelationRepo(db);
  console.log(`[${label}] DB initialized at ${dir}/memory.db`);
  return { db, memoryRepo, relationRepo, label };
}

function buildPayload(m: ReturnType<typeof setupMachine>): SyncPayload {
  const memories = m.memoryRepo.getAllForSync(PROJECT);
  const tombstones = m.memoryRepo.getTombstonesByProject(PROJECT);
  const memIds = new Set(memories.map((x) => x.id));
  const relations = m.relationRepo.getAll().filter(
    (r) => memIds.has(r.sourceId) && memIds.has(r.targetId),
  );
  return {
    version: 2,
    machine_id: m.label,
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

function push(m: ReturnType<typeof setupMachine>, gistId: string): void {
  const remote = parsePayload(readGistFile(gistId, FILENAME));
  if (remote) {
    const res = mergeFromRemote(m.memoryRepo, m.relationRepo, remote);
    console.log(`[${m.label}] pull-before-push: ins=${res.inserted} upd=${res.updated} del=${res.deleted}`);
  }
  const payload = buildPayload(m);
  updateGistFiles(gistId, { [FILENAME]: JSON.stringify(payload, null, 2) });
  console.log(`[${m.label}] pushed: ${payload.memories.length} memories, ${payload.tombstones.length} tombstones`);
}

function pull(m: ReturnType<typeof setupMachine>, gistId: string): void {
  const remote = parsePayload(readGistFile(gistId, FILENAME));
  if (!remote) {
    console.log(`[${m.label}] gist file empty`);
    return;
  }
  const res = mergeFromRemote(m.memoryRepo, m.relationRepo, remote);
  console.log(`[${m.label}] pulled: ins=${res.inserted} upd=${res.updated} del=${res.deleted}`);
}

function snapshot(m: ReturnType<typeof setupMachine>): string[] {
  return m.memoryRepo.getAllForSync(PROJECT).map((x) => x.content).sort();
}

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`❌ FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${msg}`);
  }
}

async function main() {
  console.log(`Round-trip sync test (project: ${PROJECT})`);

  // Fresh test gist (not touching the real one).
  section('Create test gist');
  const seedPath = join(tmpdir(), `${PROJECT}-seed.json`);
  writeFileSync(seedPath, JSON.stringify({
    version: 2, machine_id: 'seed', pushed_at: new Date().toISOString(),
    memories: [], relations: [], tombstones: [],
  }, null, 2));
  const gistId = createGist(FILENAME, '{}');
  unlinkSync(seedPath);
  console.log(`Test gist: ${gistId}`);

  const a = setupMachine(A_DIR, 'A');
  const b = setupMachine(B_DIR, 'B');

  try {
    // ── Scenario 1: A creates 5 memories, pushes; B pulls; both converge ──
    section('Scenario 1: create + propagate');
    const created = [];
    for (let i = 0; i < 5; i++) {
      const m = a.memoryRepo.create({
        type: 'semantic',
        content: `random-fact-${i}: the sky is ${['blue', 'green', 'purple', 'orange', 'yellow'][i]}`,
        tags: ['#roundtrip'],
        importance: 0.5,
        source: 'manual',
        project: PROJECT,
      });
      created.push(m.id);
    }
    console.log(`A created 5 memories`);
    push(a, gistId);
    pull(b, gistId);
    assert(snapshot(a).length === 5, `A has 5 memories`);
    assert(snapshot(b).length === 5, `B has 5 memories`);
    assert(JSON.stringify(snapshot(a)) === JSON.stringify(snapshot(b)), 'A and B match');

    // ── Scenario 2: A deletes 3, pushes. Bug: pull-before-push would resurrect them ──
    section('Scenario 2: delete on A, push (pull-before-push must NOT resurrect)');
    for (const id of created.slice(0, 3)) {
      a.memoryRepo.hardDelete(id);
    }
    assert(snapshot(a).length === 2, 'A has 2 memories after delete');
    console.log(`A tombstones: ${a.memoryRepo.getTombstonesByProject(PROJECT).length}`);
    push(a, gistId);
    assert(snapshot(a).length === 2, 'A still has 2 memories after push (no resurrection)');

    // ── Scenario 3: B pulls, verifies deletion propagated ──
    section('Scenario 3: B pulls, deletions propagate');
    pull(b, gistId);
    assert(snapshot(b).length === 2, 'B now has 2 memories');
    assert(b.memoryRepo.getAllTombstones().length === 3, 'B has 3 tombstones');
    assert(JSON.stringify(snapshot(a)) === JSON.stringify(snapshot(b)), 'A and B match after delete propagation');

    // ── Scenario 4: B pushes its (now-consistent) state back; A still has 2 ──
    section('Scenario 4: B pushes back, A unchanged');
    push(b, gistId);
    pull(a, gistId);
    assert(snapshot(a).length === 2, 'A still has 2 memories');

    // ── Scenario 5: Bulk purge on A propagates ──
    section('Scenario 5: bulk project purge');
    a.memoryRepo.deleteByProject(PROJECT);
    assert(snapshot(a).length === 0, 'A is empty after deleteByProject');
    push(a, gistId);
    pull(b, gistId);
    assert(snapshot(b).length === 0, 'B is empty after pull');

    console.log('\n✅ All scenarios passed');
  } finally {
    section('Cleanup');
    closeDatabase(a.db);
    closeDatabase(b.db);
    try {
      execSync(`gh gist delete ${gistId} --yes`, { stdio: 'pipe' });
      console.log(`Deleted test gist ${gistId}`);
    } catch (e) {
      console.error('Failed to delete test gist:', e);
    }
    for (const dir of [A_DIR, B_DIR]) {
      for (const f of ['memory.db', 'memory.db-shm', 'memory.db-wal']) {
        const p = join(dir, f);
        if (existsSync(p)) unlinkSync(p);
      }
    }
    console.log('Cleaned up temp DBs');
  }
}

main().catch((e) => {
  console.error('Unhandled error:', e);
  process.exit(1);
});
