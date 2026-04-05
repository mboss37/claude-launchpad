import React from 'react';
import { render } from 'ink';
import { createDatabase, closeDatabase } from '../storage/database.js';
import { migrate } from '../storage/migrator.js';
import { MemoryRepo } from '../storage/memory-repo.js';
import { RelationRepo } from '../storage/relation-repo.js';
import { SearchRepo } from '../storage/search-repo.js';
import { loadConfig, resolveDataDir } from '../config.js';
import { DashboardDataSource } from './data/data-source.js';
import { App } from './app.js';

export interface TuiOptions {
  readonly dbPath?: string;
}

export async function startTui(options?: TuiOptions): Promise<void> {
  const config = loadConfig(
    options?.dbPath ? { dataDir: options.dbPath } : undefined,
  );
  const dataDir = resolveDataDir(config.dataDir);
  const db = createDatabase({ dataDir });
  migrate(db);

  const memoryRepo = new MemoryRepo(db);
  const relationRepo = new RelationRepo(db);
  const searchRepo = new SearchRepo(db);

  const dataSource = new DashboardDataSource(
    memoryRepo, relationRepo, searchRepo, dataDir,
  );

  let shuttingDown = false;

  const { waitUntilExit, unmount } = render(
    <App dataSource={dataSource} />,
  );

  function shutdown(): void {
    if (shuttingDown) return;
    shuttingDown = true;
    dataSource.stopWatching();
    unmount();
    closeDatabase(db);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await waitUntilExit();
  } finally {
    if (!shuttingDown) {
      dataSource.stopWatching();
      closeDatabase(db);
    }
  }
}
