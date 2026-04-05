import { SyncPayloadSchema } from '../types.js';
import type { Memory, SyncPayload, SyncMemoryRow, MergeResult, RelationType } from '../types.js';
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

export { memoryToSyncRow };

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
  let relationsAdded = 0;

  const memories = payload.memories;

  for (const remote of memories) {
    const local = memoryRepo.getById(remote.id);
    if (!local) {
      memoryRepo.upsertFromSync(remote);
      inserted++;
    } else if (remote.updated_at > local.updatedAt) {
      memoryRepo.upsertFromSync(remote);
      updated++;
    }
  }

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

  return { inserted, updated, relationsAdded };
}
