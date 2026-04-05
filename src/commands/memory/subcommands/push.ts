import { hostname } from 'node:os';
import { confirm } from '@inquirer/prompts';
import { log } from '../../../lib/output.js';
import { initStorage } from './init-storage.js';
import {
  assertGhAvailable,
  loadSyncConfig,
  createGist,
  readGistFile,
  updateGistFiles,
  projectToFilename,
} from '../utils/gist-transport.js';
import { mergeFromRemote, memoryToSyncRow } from '../utils/sync-merge.js';
import { SyncPayloadSchema } from '../types.js';
import type { Memory, SyncPayload, SyncRelationRow } from '../types.js';
import { detectProject } from '../utils/project.js';

interface PushOpts {
  readonly all?: boolean;
  readonly yes?: boolean;
}

function buildPayload(
  memories: readonly ReturnType<typeof memoryToSyncRow>[],
  relations: readonly SyncRelationRow[],
): SyncPayload {
  return {
    version: 1,
    machine_id: hostname(),
    pushed_at: new Date().toISOString(),
    memories,
    relations,
  };
}

function parseRemote(raw: string | null): SyncPayload | null {
  if (!raw || raw === 'null') return null;
  try { return SyncPayloadSchema.parse(JSON.parse(raw)); }
  catch { return null; }
}

export async function runPush(opts: PushOpts): Promise<void> {
  assertGhAvailable();

  const { requireMemoryDeps } = await import('../utils/require-deps.js');
  await requireMemoryDeps();
  const ctx = initStorage();

  try {
    const syncConfig = loadSyncConfig();
    const allRelations = ctx.relationRepo.getAll();

    if (opts.all) {
      return await pushAll(ctx, allRelations, syncConfig, opts);
    }

    const project = detectProject(process.cwd());
    if (!project) {
      log.error('Could not detect project. Run from a project directory or use --all.');
      return;
    }

    const filename = projectToFilename(project);
    const memories = ctx.memoryRepo.getAllForSync(project);

    // Pull-before-push for this project
    if (syncConfig) {
      const remote = parseRemote(readGistFile(syncConfig.gistId, filename));
      if (remote) {
        mergeFromRemote(ctx.memoryRepo, ctx.relationRepo, remote);
      }
    }

    const freshMemories = ctx.memoryRepo.getAllForSync(project);
    const memoryIds = new Set(freshMemories.map((m) => m.id));
    const relations = filterRelations(allRelations, memoryIds);
    const payload = buildPayload(freshMemories.map(memoryToSyncRow), relations);
    const json = JSON.stringify(payload, null, 2);

    if (!syncConfig) {
      if (!opts.yes) {
        const proceed = await confirm({
          message: 'Create a private GitHub Gist for memory sync?',
          default: true,
        });
        if (!proceed) { log.info('Skipped.'); return; }
      }
      createGist(filename, json);
    } else {
      updateGistFiles(syncConfig.gistId, { [filename]: json });
    }

    log.blank();
    log.step('Push complete');
    log.info(`Project:   ${project} (${freshMemories.length} memories)`);
    log.info(`Relations: ${relations.length}`);
    log.blank();
  } finally {
    ctx.close();
  }
}

async function pushAll(
  ctx: ReturnType<typeof initStorage>,
  allRelations: readonly { sourceId: string; targetId: string; relationType: string; createdAt: string }[],
  syncConfig: { gistId: string } | null,
  opts: PushOpts,
): Promise<void> {
  const allMemories = ctx.memoryRepo.getAllForSync();
  const byProject = new Map<string, Memory[]>();
  for (const m of allMemories) {
    const key = m.project ?? '_global';
    const list = byProject.get(key) ?? [];
    list.push(m);
    byProject.set(key, list);
  }

  const files: Record<string, string> = {};
  for (const [project, memories] of byProject) {
    const memoryIds = new Set(memories.map((m) => m.id));
    const relations = filterRelations(allRelations, memoryIds);
    const payload = buildPayload(memories.map(memoryToSyncRow), relations);
    files[projectToFilename(project)] = JSON.stringify(payload, null, 2);
  }

  if (!syncConfig) {
    if (!opts.yes) {
      const proceed = await confirm({
        message: 'Create a private GitHub Gist for memory sync?',
        default: true,
      });
      if (!proceed) { log.info('Skipped.'); return; }
    }
    const [firstName, firstContent] = Object.entries(files)[0]!;
    const gistId = createGist(firstName, firstContent);
    const rest = Object.fromEntries(Object.entries(files).slice(1));
    if (Object.keys(rest).length > 0) {
      updateGistFiles(gistId, rest);
    }
  } else {
    updateGistFiles(syncConfig.gistId, files);
  }

  log.blank();
  log.step('Push complete');
  log.info(`Projects:  ${byProject.size}`);
  log.info(`Memories:  ${allMemories.length}`);
  log.blank();
}

function filterRelations(
  allRelations: readonly { sourceId: string; targetId: string; relationType: string; createdAt: string }[],
  memoryIds: ReadonlySet<string>,
): readonly SyncRelationRow[] {
  return allRelations
    .filter((r) => memoryIds.has(r.sourceId) && memoryIds.has(r.targetId))
    .map((r) => ({
      source_id: r.sourceId,
      target_id: r.targetId,
      relation_type: r.relationType as SyncRelationRow['relation_type'],
      created_at: r.createdAt,
    }));
}
