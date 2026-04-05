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
    const memories = ctx.memoryRepo.getAllForSync(opts.project);
    const allRelations = ctx.relationRepo.getAll();
    const memoryIds = new Set(memories.map((m) => m.id));
    const relations: readonly SyncRelationRow[] = allRelations
      .filter((r) => memoryIds.has(r.sourceId) && memoryIds.has(r.targetId))
      .map((r) => ({
        source_id: r.sourceId,
        target_id: r.targetId,
        relation_type: r.relationType,
        created_at: r.createdAt,
      }));

    const payload: SyncPayload = {
      version: 1,
      machine_id: hostname(),
      pushed_at: new Date().toISOString(),
      memories: memories.map(memoryToSyncRow),
      relations,
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
    log.info(`Memories:  ${memories.length}`);
    log.info(`Relations: ${relations.length}`);
    if (opts.project) log.info(`Project:   ${opts.project}`);
    log.blank();
  } finally {
    ctx.close();
  }
}
