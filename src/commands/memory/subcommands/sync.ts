import { log } from '../../../lib/output.js';
import { loadSyncConfig } from '../utils/gist-transport.js';

interface SyncOpts {
  readonly all?: boolean;
  readonly yes?: boolean;
}

/**
 * Pull then push in one call — the everyday cross-machine command.
 * First sync (no gist yet) skips the pull; push creates the gist.
 * Push itself does pull-before-push, so a remote change landing between
 * the two steps still merges instead of being overwritten.
 */
export async function runSync(opts: SyncOpts): Promise<void> {
  if (loadSyncConfig()) {
    const { runPull } = await import('./pull.js');
    await runPull({ all: opts.all });
  } else {
    log.info('No sync gist yet — skipping pull; push will create it.');
  }
  const { runPush } = await import('./push.js');
  await runPush(opts);
}
