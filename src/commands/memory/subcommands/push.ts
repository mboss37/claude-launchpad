import { hostname } from 'node:os';
import { confirm } from '@inquirer/prompts';
import { log } from '../../../lib/output.js';
import { initStorage } from './init-storage.js';
import type { StorageContext } from './init-storage.js';
import {
  assertGhAvailable,
  loadSyncConfig,
  createGist,
  readGistFile,
  updateGistFiles,
  projectToFilename,
} from '../utils/gist-transport.js';
import { mergeFromRemote, memoryToSyncRow, parsePayload } from '../utils/sync-merge.js';
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

export async function runPush(opts: PushOpts): Promise<void> {
  assertGhAvailable();

  const { requireMemoryDeps } = await import('../utils/require-deps.js');
  await requireMemoryDeps();
  const ctx = initStorage();

  try {
    const syncConfig = loadSyncConfig();
    const allRelations = ctx.relationRepo.getAll();

    if (opts.all) {
      await pushAll(ctx, allRelations, syncConfig, opts);
    } else {
      await pushProject(ctx, allRelations, syncConfig, opts);
    }
  } finally {
    ctx.close();
  }
}

async function pushProject(
  ctx: StorageContext,
  allRelations: readonly { sourceId: string; targetId: string; relationType: string; createdAt: string }[],
  syncConfig: { gistId: string } | null,
  opts: PushOpts,
): Promise<void> {
  const project = detectProject(process.cwd());
  if (!project) {
    log.error('Could not detect project. Run from a project directory or use --all.');
    return;
  }

  const filename = projectToFilename(project);

  // Pull-before-push for this project
  if (syncConfig) {
    const remote = parsePayload(readGistFile(syncConfig.gistId, filename));
    if (remote) mergeFromRemote(ctx.memoryRepo, ctx.relationRepo, remote);
  }

  const memories = ctx.memoryRepo.getAllForSync(project);
  const memoryIds = new Set(memories.map((m) => m.id));
  const relations = filterRelations(allRelations, memoryIds);
  const json = JSON.stringify(buildPayload(memories.map(memoryToSyncRow), relations), null, 2);

  if (!syncConfig) {
    if (!opts.yes && !(await confirmCreate())) return;
    createGist(filename, json);
  } else {
    updateGistFiles(syncConfig.gistId, { [filename]: json });
  }

  log.blank();
  log.step('Push complete');
  log.info(`Project:   ${project} (${memories.length} memories)`);
  log.info(`Relations: ${relations.length}`);
  log.blank();
}

async function pushAll(
  ctx: StorageContext,
  allRelations: readonly { sourceId: string; targetId: string; relationType: string; createdAt: string }[],
  syncConfig: { gistId: string } | null,
  opts: PushOpts,
): Promise<void> {
  const allMemories = ctx.memoryRepo.getAllForSync();
  const byProject = groupByProject(allMemories);

  const files: Record<string, string> = {};
  for (const [project, memories] of byProject) {
    const memoryIds = new Set(memories.map((m) => m.id));
    const relations = filterRelations(allRelations, memoryIds);
    files[projectToFilename(project)] = JSON.stringify(
      buildPayload(memories.map(memoryToSyncRow), relations), null, 2,
    );
  }

  if (!syncConfig) {
    if (!opts.yes && !(await confirmCreate())) return;
    const entries = Object.entries(files);
    const gistId = createGist(entries[0]![0], entries[0]![1]);
    if (entries.length > 1) {
      updateGistFiles(gistId, Object.fromEntries(entries.slice(1)));
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

function groupByProject(memories: readonly Memory[]): Map<string, Memory[]> {
  const byProject = new Map<string, Memory[]>();
  for (const m of memories) {
    const key = m.project ?? '_global';
    const list = byProject.get(key) ?? [];
    list.push(m);
    byProject.set(key, list);
  }
  return byProject;
}

async function confirmCreate(): Promise<boolean> {
  const proceed = await confirm({
    message: 'Create a private GitHub Gist for memory sync?',
    default: true,
  });
  if (!proceed) log.info('Skipped.');
  return proceed;
}
