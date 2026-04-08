import { confirm } from '@inquirer/prompts';
import { log } from '../../../lib/output.js';
import {
  assertGhAvailable,
  loadSyncConfig,
  listGistFiles,
  filenameToProject,
  projectToFilename,
  deleteGistFile,
} from '../utils/gist-transport.js';

interface SyncCleanOpts {
  readonly yes?: boolean;
}

export async function runSyncClean(project: string, opts: SyncCleanOpts): Promise<void> {
  assertGhAvailable();

  const syncConfig = loadSyncConfig();
  if (!syncConfig) {
    log.error('No sync gist found. Run `memory push` first.');
    return;
  }

  const filename = projectToFilename(project);
  const files = listGistFiles(syncConfig.gistId);
  const projectFiles = files.filter((f) => filenameToProject(f) !== null);

  if (!projectFiles.includes(filename)) {
    log.error(`Project "${project}" not found in gist.`);
    if (projectFiles.length > 0) {
      log.blank();
      log.info('Available projects:');
      for (const f of projectFiles) {
        log.info(`  ${filenameToProject(f)}`);
      }
    }
    return;
  }

  if (!opts.yes) {
    const proceed = await confirm({
      message: `Remove "${project}" from sync gist? This only removes the remote copy.`,
      default: false,
    });
    if (!proceed) {
      log.info('Skipped.');
      return;
    }
  }

  deleteGistFile(syncConfig.gistId, filename);
  log.success(`Removed "${project}" from sync gist.`);
}
