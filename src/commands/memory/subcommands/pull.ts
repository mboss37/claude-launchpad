import { log } from '../../../lib/output.js';
import { initStorage } from './init-storage.js';
import { assertGhAvailable, loadSyncConfig, readGist } from '../utils/gist-transport.js';
import { mergeFromRemote } from '../utils/sync-merge.js';
import { SyncPayloadSchema } from '../types.js';
import type { SyncPayload } from '../types.js';

interface PullOpts {
  readonly project?: string;
}

function parsePayload(raw: string): SyncPayload | null {
  try {
    const parsed = JSON.parse(raw);
    return SyncPayloadSchema.parse(parsed);
  } catch {
    return null;
  }
}

export async function runPull(opts: PullOpts): Promise<void> {
  assertGhAvailable();

  const syncConfig = loadSyncConfig();
  if (!syncConfig) {
    log.error('No sync configured. Run `memory push` first to create a gist.');
    return;
  }

  const raw = readGist(syncConfig.gistId);
  if (!raw) {
    log.error('Gist is empty or not found. It may have been deleted.');
    return;
  }

  const payload = parsePayload(raw);
  if (!payload) {
    log.error('Corrupted or incompatible sync data. Could not parse gist.');
    return;
  }

  const { requireMemoryDeps } = await import('../utils/require-deps.js');
  await requireMemoryDeps();
  const ctx = initStorage();

  try {
    const result = mergeFromRemote(ctx.memoryRepo, ctx.relationRepo, payload, opts.project);
    log.blank();
    if (result.inserted === 0 && result.updated === 0 && result.relationsAdded === 0) {
      log.step('Already in sync');
      log.info(`From: ${payload.machine_id} (${payload.pushed_at})`);
    } else {
      log.step('Pull complete');
      log.info(`From:      ${payload.machine_id} (${payload.pushed_at})`);
      if (result.inserted > 0) log.info(`Inserted:  ${result.inserted}`);
      if (result.updated > 0) log.info(`Updated:   ${result.updated}`);
      if (result.relationsAdded > 0) log.info(`Relations: ${result.relationsAdded} added`);
    }
    log.blank();
  } finally {
    ctx.close();
  }
}
