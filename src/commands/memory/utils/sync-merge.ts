import { SyncPayloadSchema } from '../types.js';
import type { Memory, SyncPayload, SyncMemoryRow, SyncTombstone, MergeResult, RelationType, Tombstone } from '../types.js';
import type { MemoryRepo } from '../storage/memory-repo.js';
import type { RelationRepo } from '../storage/relation-repo.js';

function memoryToSyncRow(m: Memory): SyncMemoryRow {
  return {
    id: m.id,
    type: m.type,
    title: m.title,
    content: m.content,
    context: m.context,
    source: m.source,
    project: m.project,
    tags: [...m.tags],
    importance: m.importance,
    access_count: m.accessCount,
    injection_count: m.injectionCount,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    last_accessed: m.lastAccessed,
  };
}

function tombstoneToSyncRow(t: Tombstone): SyncTombstone {
  return { id: t.id, project: t.project, deleted_at: t.deletedAt };
}

export { memoryToSyncRow, tombstoneToSyncRow };

export function parsePayload(raw: string | null): SyncPayload | null {
  if (!raw || raw === 'null') return null;
  try { return SyncPayloadSchema.parse(JSON.parse(raw)); }
  catch { return null; }
}

export function mergeFromRemote(
  memoryRepo: MemoryRepo,
  relationRepo: RelationRepo,
  payload: SyncPayload,
): MergeResult {
  let inserted = 0;
  let updated = 0;
  let deleted = 0;
  let relationsAdded = 0;

  // Phase 1: apply remote tombstones — delete locally or persist the tombstone
  // so future remote memory rows with older updated_at don't resurrect them.
  // Tie-break: delete wins when timestamps are equal (matches Phase 2 semantics).
  // upsertTombstone is safe to call unconditionally — ON CONFLICT keeps the newer row.
  for (const t of payload.tombstones) {
    const local = memoryRepo.getById(t.id);
    if (local && local.updatedAt <= t.deleted_at) {
      memoryRepo.hardDelete(t.id);
      deleted++;
    }
    memoryRepo.upsertTombstone(t.id, t.project, t.deleted_at);
  }

  // Phase 2: merge remote memories, honoring local tombstones
  for (const remote of payload.memories) {
    const tombstone = memoryRepo.getTombstone(remote.id);
    if (tombstone && tombstone.deletedAt >= remote.updated_at) {
      // Delete wins; skip this memory.
      continue;
    }
    if (tombstone && tombstone.deletedAt < remote.updated_at) {
      // Remote update is newer than the delete — resurrect and drop the stale tombstone.
      memoryRepo.deleteTombstone(remote.id);
    }

    const local = memoryRepo.getById(remote.id);
    if (!local) {
      memoryRepo.upsertFromSync(remote);
      inserted++;
    } else if (remote.updated_at > local.updatedAt) {
      memoryRepo.upsertFromSync(remote);
      updated++;
    }
  }

  // Phase 3: relations — only link memories that survived both phases.
  const localIds = new Set(memoryRepo.getAll().map((m) => m.id));
  const relations = payload.relations.filter(
    (r) => localIds.has(r.source_id) && localIds.has(r.target_id),
  );

  for (const rel of relations) {
    const added = relationRepo.create(
      rel.source_id,
      rel.target_id,
      rel.relation_type as RelationType,
    );
    if (added) relationsAdded++;
  }

  return { inserted, updated, deleted, relationsAdded };
}
