import chalk from 'chalk';
import { RetrievalService } from '../services/retrieval-service.js';
import { log } from '../../../lib/output.js';
import { initStorage } from './init-storage.js';
import type { MemoryType } from '../types.js';

interface SearchOpts {
  readonly type?: string;
  readonly limit?: string;
  readonly json?: boolean;
  readonly dbPath?: string;
}

export async function runSearch(query: string, opts: SearchOpts): Promise<void> {
  if (!query) {
    log.error('Usage: claude-launchpad memory search <query> [--type <type>] [--limit <n>] [--json]');
    process.exit(1);
  }

  const ctx = initStorage(opts.dbPath);

  try {
    const retrievalService = new RetrievalService({
      memoryRepo: ctx.memoryRepo,
      relationRepo: ctx.relationRepo,
      searchRepo: ctx.searchRepo,
    });

    const limit = opts.limit ? parseInt(opts.limit, 10) : 10;
    const results = await retrievalService.search({
      query,
      limit,
      type: opts.type as MemoryType | undefined,
      min_importance: 0,
    });

    if (opts.json) {
      process.stdout.write(JSON.stringify(results.map(r => ({
        id: r.memory.id,
        type: r.memory.type,
        title: r.memory.title,
        content: r.memory.content,
        score: r.score,
        explanation: r.explanation,
      })), null, 2) + '\n');
      return;
    }

    if (results.length === 0) {
      log.info('No memories found.');
      return;
    }

    log.blank();
    log.step(`Found ${results.length} memories:`);
    log.blank();

    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      const title = r.memory.title ?? '(untitled)';
      const snippet = r.memory.content.slice(0, 120) + (r.memory.content.length > 120 ? '...' : '');
      console.log(`  ${chalk.bold(`${i + 1}.`)} ${chalk.cyan(`[${r.memory.type}]`)} ${title} - score: ${r.score.toFixed(3)}`);
      console.log(`     ${chalk.dim(snippet)}`);
      console.log(`     ${chalk.dim(r.explanation)}`);
      log.blank();
    }
  } finally {
    ctx.close();
  }
}
