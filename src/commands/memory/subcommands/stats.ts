import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { log } from '../../../lib/output.js';
import { initStorage } from './init-storage.js';

interface StatsOpts {
  readonly json?: boolean;
  readonly dbPath?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export async function runStats(opts: StatsOpts): Promise<void> {
  const ctx = initStorage(opts.dbPath);

  try {
    const total = ctx.memoryRepo.count();
    const byType = ctx.memoryRepo.countByType();
    const relations = ctx.relationRepo.count();
    const dateRange = ctx.memoryRepo.dateRange();
    const topInjected = ctx.memoryRepo.topInjected(5);

    let dbSize = 0;
    try {
      const dbPath = join(ctx.dataDir, 'memory.db');
      if (existsSync(dbPath)) {
        dbSize = statSync(dbPath).size;
      }
    } catch { /* ignore */ }

    if (opts.json) {
      process.stdout.write(JSON.stringify({
        totalMemories: total,
        byType,
        totalRelations: relations,
        dbSizeBytes: dbSize,
        oldestMemory: dateRange.oldest,
        newestMemory: dateRange.newest,
        topInjected,
      }, null, 2) + '\n');
    } else {
      log.blank();
      log.step('Memory stats');
      log.info(`Memories:   ${total}`);
      for (const [type, count] of Object.entries(byType)) {
        log.info(`  ${type}: ${count}`);
      }
      log.info(`Relations:  ${relations}`);
      log.info(`DB size:    ${formatBytes(dbSize)}`);
      log.info(`Oldest:     ${dateRange.oldest ?? 'none'}`);
      log.info(`Newest:     ${dateRange.newest ?? 'none'}`);
      if (topInjected.length > 0) {
        log.blank();
        log.info('Top injected:');
        for (const m of topInjected) {
          log.info(`  ${m.title ?? m.id} (${m.injectionCount}x)`);
        }
      }
      log.blank();
    }
  } finally {
    ctx.close();
  }
}
