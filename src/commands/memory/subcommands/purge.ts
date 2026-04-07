import { confirm } from '@inquirer/prompts';
import { log } from '../../../lib/output.js';
import { initStorage } from './init-storage.js';

interface PurgeOpts {
  readonly project: string;
  readonly yes?: boolean;
  readonly dbPath?: string;
}

export async function runPurge(opts: PurgeOpts): Promise<void> {
  const { requireMemoryDeps } = await import('../utils/require-deps.js');
  await requireMemoryDeps();
  const ctx = initStorage(opts.dbPath);

  try {
    const count = ctx.memoryRepo.count(opts.project);

    if (count === 0) {
      log.info(`No memories found for project "${opts.project}".`);
      return;
    }

    if (!opts.yes) {
      const proceed = await confirm({
        message: `Delete ${count} memories for project "${opts.project}"? This cannot be undone.`,
        default: false,
      });
      if (!proceed) {
        log.info('Cancelled.');
        return;
      }
    }

    const deleted = ctx.memoryRepo.deleteByProject(opts.project);
    const orphaned = ctx.relationRepo.deleteOrphaned();

    log.blank();
    log.success(`Purged ${deleted} memories for project "${opts.project}".`);
    if (orphaned > 0) {
      log.info(`Cleaned up ${orphaned} orphaned relations.`);
    }
    log.blank();
  } finally {
    ctx.close();
  }
}
