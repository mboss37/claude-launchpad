import { log } from '../../../lib/output.js';
import { initStorage } from './init-storage.js';
import {
  assertGhAvailable,
  loadSyncConfig,
  readGistFile,
  listGistFiles,
  filenameToProject,
  projectToFilename,
} from '../utils/gist-transport.js';
import { mergeFromRemote, parsePayload } from '../utils/sync-merge.js';
import type { SyncPayload, MergeResult } from '../types.js';
import { detectProject } from '../utils/project.js';

interface PullOpts {
  readonly all?: boolean;
}

export async function runPull(opts: PullOpts): Promise<void> {
  assertGhAvailable();

  const syncConfig = loadSyncConfig();
  if (!syncConfig) {
    log.error('No sync gist found. Run `memory push` first.');
    return;
  }

  const { requireMemoryDeps } = await import('../utils/require-deps.js');
  await requireMemoryDeps();
  const ctx = initStorage();

  try {
    if (opts.all) {
      pullAll(ctx, syncConfig.gistId);
    } else {
      pullProject(ctx, syncConfig.gistId);
    }
  } finally {
    ctx.close();
  }
}

function pullProject(ctx: ReturnType<typeof initStorage>, gistId: string): void {
  const project = detectProject(process.cwd());
  if (!project) {
    log.error('Could not detect project. Run from a project directory or use --all.');
    return;
  }

  const filename = projectToFilename(project);
  const payload = parsePayload(readGistFile(gistId, filename));
  if (!payload) {
    log.error(`No memories found for project "${project}" in gist.`);
    return;
  }

  const localCount = ctx.memoryRepo.count(project);
  if (localCount === 0) {
    log.warn(`No local memories for "${project}" — creating fresh database from remote.`);
  }

  const result = mergeFromRemote(ctx.memoryRepo, ctx.relationRepo, payload);
  printResult(result, project);
}

function pullAll(ctx: ReturnType<typeof initStorage>, gistId: string): void {
  const files = listGistFiles(gistId);
  const projectFiles = files.filter((f) => filenameToProject(f) !== null);

  if (projectFiles.length === 0) {
    log.error('No memory files found in gist.');
    return;
  }

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalRelations = 0;

  for (const filename of projectFiles) {
    const payload = parsePayload(readGistFile(gistId, filename));
    if (!payload) continue;
    const result = mergeFromRemote(ctx.memoryRepo, ctx.relationRepo, payload);
    totalInserted += result.inserted;
    totalUpdated += result.updated;
    totalRelations += result.relationsAdded;
  }

  log.blank();
  if (totalInserted === 0 && totalUpdated === 0 && totalRelations === 0) {
    log.step('Already in sync');
  } else {
    log.step('Pull complete');
    if (totalInserted > 0) log.info(`Inserted:  ${totalInserted}`);
    if (totalUpdated > 0) log.info(`Updated:   ${totalUpdated}`);
    if (totalRelations > 0) log.info(`Relations: ${totalRelations} added`);
  }
  log.info(`Projects:  ${projectFiles.length}`);
  log.blank();
}

function printResult(result: MergeResult, project: string): void {
  log.blank();
  if (result.inserted === 0 && result.updated === 0 && result.relationsAdded === 0) {
    log.step('Already in sync');
    log.info(`Project: ${project}`);
  } else {
    log.step('Pull complete');
    log.info(`Project:   ${project}`);
    if (result.inserted > 0) log.info(`Inserted:  ${result.inserted}`);
    if (result.updated > 0) log.info(`Updated:   ${result.updated}`);
    if (result.relationsAdded > 0) log.info(`Relations: ${result.relationsAdded} added`);
  }
  log.blank();
}
