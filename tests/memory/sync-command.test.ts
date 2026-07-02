import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSync } from '../../src/commands/memory/subcommands/sync.js';

const calls: string[] = [];
let syncConfig: { gistId: string } | null = null;
let pullOpts: unknown;
let pushOpts: unknown;

vi.mock('../../src/commands/memory/utils/gist-transport.js', () => ({
  loadSyncConfig: () => syncConfig,
}));
vi.mock('../../src/commands/memory/subcommands/pull.js', () => ({
  runPull: async (opts: unknown) => { calls.push('pull'); pullOpts = opts; },
}));
vi.mock('../../src/commands/memory/subcommands/push.js', () => ({
  runPush: async (opts: unknown) => { calls.push('push'); pushOpts = opts; },
}));

beforeEach(() => {
  calls.length = 0;
  pullOpts = undefined;
  pushOpts = undefined;
});

describe('runSync', () => {
  it('pulls before pushing when a gist is configured', async () => {
    syncConfig = { gistId: 'abc123' };
    await runSync({ all: true, yes: true });
    expect(calls).toEqual(['pull', 'push']);
    expect(pullOpts).toEqual({ all: true, quietMissing: true });
    expect(pushOpts).toEqual({ all: true, yes: true });
  });

  it('skips the pull on first sync (no gist yet) — push creates the gist', async () => {
    syncConfig = null;
    await runSync({});
    expect(calls).toEqual(['push']);
  });

  it('tolerates a project with no remote file yet (quietMissing forwarded)', async () => {
    syncConfig = { gistId: 'abc123' };
    await runSync({});
    expect(pullOpts).toEqual({ all: undefined, quietMissing: true });
  });
});
