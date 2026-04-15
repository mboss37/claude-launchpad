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
import type { MergeResult } from '../types.js';
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

  const perProject: { project: string; result: MergeResult }[] = [];
  const skipped: string[] = [];
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalRelations = 0;

  for (const filename of projectFiles) {
    const project = filenameToProject(filename);
    if (!project) continue;

    // Skip projects not set up on this machine (zero local memories).
    // User must `cd` into the project and run `memory pull` to opt-in to a new project.
    if (ctx.memoryRepo.count(project) === 0) {
      skipped.push(project);
      continue;
    }

    const payload = parsePayload(readGistFile(gistId, filename));
    if (!payload) continue;
    const result = mergeFromRemote(ctx.memoryRepo, ctx.relationRepo, payload);
    perProject.push({ project, result });
    totalInserted += result.inserted;
    totalUpdated += result.updated;
    totalRelations += result.relationsAdded;
  }

  const changed = perProject.filter((p) => p.result.inserted > 0 || p.result.updated > 0 || p.result.relationsAdded > 0);
  const syncedCount = perProject.length;

  log.blank();
  if (syncedCount === 0) {
    log.step('No locally set up projects to sync');
  } else if (changed.length === 0) {
    log.step(`Already in sync (${syncedCount} project${syncedCount === 1 ? '' : 's'})`);
  } else {
    log.step(`Pull complete (${changed.length} of ${syncedCount} projects updated)`);
    for (const { project, result } of changed) {
      const parts: string[] = [];
      if (result.inserted > 0) parts.push(`+${result.inserted} new`);
      if (result.updated > 0) parts.push(`~${result.updated} updated`);
      if (result.relationsAdded > 0) parts.push(`+${result.relationsAdded} relations`);
      log.info(`${project.padEnd(30)}  ${parts.join(', ')}`);
    }
    if (totalInserted + totalUpdated + totalRelations > 0) {
      log.blank();
      log.info(`Total: +${totalInserted} new, ~${totalUpdated} updated, +${totalRelations} relations`);
    }
  }
  if (skipped.length > 0) {
    log.blank();
    log.info(`Skipped ${skipped.length} project${skipped.length === 1 ? '' : 's'} not set up on this machine:`);
    for (const project of skipped) log.info(`  - ${project}`);
    log.info('Run `memory pull` from a project directory to pull that project for the first time.');
  }
  log.blank();
}

function printResult(result: MergeResult, project: string): void {
  log.blank();
  if (result.inserted === 0 && result.updated === 0 && result.relationsAdded === 0) {
    log.step(`${project}: already in sync`);
  } else {
    log.step(`${project}: pull complete`);
    if (result.inserted > 0) log.info(`Inserted:  ${result.inserted}`);
    if (result.updated > 0) log.info(`Updated:   ${result.updated}`);
    if (result.relationsAdded > 0) log.info(`Relations: ${result.relationsAdded} added`);
  }
  log.info('Tip: run `memory pull --all` to sync every project in this gist.');
  log.blank();
}
