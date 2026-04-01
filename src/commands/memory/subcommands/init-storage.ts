import { createDatabase, closeDatabase } from '../storage/database.js';
import { migrate } from '../storage/migrator.js';
import { MemoryRepo } from '../storage/memory-repo.js';
import { RelationRepo } from '../storage/relation-repo.js';
import { SearchRepo } from '../storage/search-repo.js';
import { loadConfig, resolveDataDir } from '../config.js';
import type { Config } from '../config.js';
import type Database from 'better-sqlite3';

export interface StorageContext {
  readonly config: Config;
  readonly dataDir: string;
  readonly db: Database.Database;
  readonly memoryRepo: MemoryRepo;
  readonly relationRepo: RelationRepo;
  readonly searchRepo: SearchRepo;
  readonly close: () => void;
}

export function initStorage(dbPath?: string): StorageContext {
  const config = loadConfig(dbPath ? { dataDir: dbPath } : undefined);
  const dataDir = resolveDataDir(config.dataDir);
  const db = createDatabase({ dataDir });
  migrate(db);

  return {
    config,
    dataDir,
    db,
    memoryRepo: new MemoryRepo(db),
    relationRepo: new RelationRepo(db),
    searchRepo: new SearchRepo(db),
    close: () => closeDatabase(db),
  };
}
