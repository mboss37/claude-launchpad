import { hostname } from 'node:os';
import { confirm } from '@inquirer/prompts';
import { log } from '../../../lib/output.js';
import { initStorage } from './init-storage.js';
import {
  assertGhAvailable,
  loadSyncConfig,
  readGist,
  createGist,
  updateGist,
} from '../utils/gist-transport.js';
import { mergeFromRemote, memoryToSyncRow } from '../utils/sync-merge.js';
import { SyncPayloadSchema } from '../types.js';
import type { SyncPayload, SyncRelationRow } from '../types.js';

interface PushOpts {
  readonly project?: string;
  readonly yes?: boolean;
}

export async function runPush(opts: PushOpts): Promise<void> {
  assertGhAvailable();

  const { requireMemoryDeps } = await import('../utils/require-deps.js');
  await requireMemoryDeps();
  const ctx = initStorage();

  try {
    const syncConfig = loadSyncConfig();

    // Pull-before-push: merge remote changes first
    if (syncConfig) {
      const raw = readGist(syncConfig.gistId);
      if (raw) {
        try {
          const remote = SyncPayloadSchema.parse(JSON.parse(raw));
          mergeFromRemote(ctx.memoryRepo, ctx.relationRepo, remote, opts.project);
        } catch { /* ignore corrupt remote — overwrite with fresh data */ }
      }
    }

    // Serialize local memories
    const localMemories = ctx.memoryRepo.getAllForSync(opts.project);
    const allRelations = ctx.relationRepo.getAll();

    // For project-scoped push: merge local project memories into existing gist
    // so other projects' memories aren't nuked
    let finalMemories = localMemories.map(memoryToSyncRow);
    let finalRelations: readonly SyncRelationRow[] = [];

    if (opts.project && syncConfig) {
      const raw = readGist(syncConfig.gistId);
      if (raw) {
        try {
          const existing = SyncPayloadSchema.parse(JSON.parse(raw));
          const otherMemories = existing.memories.filter((m) => m.project !== opts.project);
          finalMemories = [...otherMemories, ...finalMemories];
          const otherRelations = existing.relations.filter((r) => {
            const localIds = new Set(localMemories.map((m) => m.id));
            return !localIds.has(r.source_id) && !localIds.has(r.target_id);
          });
          finalRelations = [...otherRelations];
        } catch { /* corrupt gist — overwrite */ }
      }
    }

    const memoryIds = new Set(finalMemories.map((m) => m.id));
    const localRelations: readonly SyncRelationRow[] = allRelations
      .filter((r) => memoryIds.has(r.sourceId) && memoryIds.has(r.targetId))
      .map((r) => ({
        source_id: r.sourceId,
        target_id: r.targetId,
        relation_type: r.relationType,
        created_at: r.createdAt,
      }));

    const mergedRelations = [...new Map(
      [...finalRelations, ...localRelations].map((r) => [`${r.source_id}:${r.target_id}:${r.relation_type}`, r]),
    ).values()];

    const payload: SyncPayload = {
      version: 1,
      machine_id: hostname(),
      pushed_at: new Date().toISOString(),
      memories: finalMemories,
      relations: mergedRelations,
    };

    const json = JSON.stringify(payload, null, 2);

    if (!syncConfig) {
      if (!opts.yes) {
        const proceed = await confirm({
          message: 'Create a private GitHub Gist for memory sync?',
          default: true,
        });
        if (!proceed) {
          log.info('Skipped.');
          return;
        }
      }
      createGist(json);
    } else {
      updateGist(syncConfig.gistId, json);
    }

    log.blank();
    log.step('Push complete');
    if (opts.project) {
      log.info(`Project:   ${opts.project} (${localMemories.length} memories)`);
      log.info(`Total:     ${finalMemories.length} memories in gist`);
    } else {
      log.info(`Memories:  ${finalMemories.length}`);
    }
    log.info(`Relations: ${mergedRelations.length}`);
    log.blank();
  } finally {
    ctx.close();
  }
}
