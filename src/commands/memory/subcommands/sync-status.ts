import { log } from '../../../lib/output.js';
import { initStorage } from './init-storage.js';
import {
  assertGhAvailable,
  loadSyncConfig,
  listGistFiles,
  filenameToProject,
  readGistFile,
} from '../utils/gist-transport.js';
import { parsePayload } from '../utils/sync-merge.js';

export async function runSyncStatus(): Promise<void> {
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
    const localCounts = ctx.memoryRepo.projectCounts();
    const remoteFiles = listGistFiles(syncConfig.gistId);
    const remoteProjects = remoteFiles
      .map((f) => filenameToProject(f))
      .filter((p): p is string => p !== null);

    const remoteCounts = new Map<string, number>();
    for (const file of remoteFiles) {
      const project = filenameToProject(file);
      if (!project) continue;
      const payload = parsePayload(readGistFile(syncConfig.gistId, file));
      remoteCounts.set(project, payload?.memories.length ?? 0);
    }

    const allProjects = new Set([...localCounts.keys(), ...remoteCounts.keys()]);

    log.blank();
    log.step('Sync status');
    log.info(`Gist: ${syncConfig.gistId}`);
    log.blank();

    if (allProjects.size === 0) {
      log.info('No projects found locally or remotely.');
    } else {
      log.info('Project                          Local  Remote');
      log.info('───────────────────────────────  ─────  ──────');
      for (const project of [...allProjects].sort()) {
        const local = localCounts.get(project) ?? 0;
        const remote = remoteCounts.get(project) ?? 0;
        const name = project.length > 33 ? project.slice(0, 30) + '...' : project;
        log.info(`${name.padEnd(33)} ${String(local).padStart(5)}  ${String(remote).padStart(6)}`);
      }
    }
    log.blank();
  } finally {
    ctx.close();
  }
}
