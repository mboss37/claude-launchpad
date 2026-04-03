import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DecayService } from '../services/decay-service.js';
import { ConsolidationService } from '../services/consolidation-service.js';
import { InjectionService } from '../services/injection-service.js';
import { detectProject } from '../utils/project.js';
import { getGitContext } from '../utils/git-context.js';
import { initStorage } from './init-storage.js';

interface ContextOpts {
  readonly json?: boolean;
  readonly dbPath?: string;
}

const CONSOLIDATION_FILE = '.last-consolidation';

function shouldConsolidate(dataDir: string, intervalDays: number): boolean {
  const checkpointPath = join(dataDir, CONSOLIDATION_FILE);
  try {
    const raw = readFileSync(checkpointPath, 'utf-8').trim();
    const lastRun = parseInt(raw, 10);
    if (isNaN(lastRun)) return true;
    const daysSince = (Date.now() - lastRun) / 86_400_000;
    return daysSince >= intervalDays;
  } catch {
    return true;
  }
}

function markConsolidated(dataDir: string): void {
  writeFileSync(join(dataDir, CONSOLIDATION_FILE), String(Date.now()), 'utf-8');
}

function write(msg: string): void {
  process.stdout.write(msg + '\n');
}

export async function runContext(opts: ContextOpts): Promise<void> {
  const ctx = initStorage(opts.dbPath);

  try {
    // Run maintenance (decay + consolidation) before loading context
    try {
      const decayService = new DecayService({
        memoryRepo: ctx.memoryRepo,
        relationRepo: ctx.relationRepo,
      });
      decayService.run();

      if (shouldConsolidate(ctx.dataDir, ctx.config.consolidationInterval)) {
        const consolidationService = new ConsolidationService({
          memoryRepo: ctx.memoryRepo,
          relationRepo: ctx.relationRepo,
        });
        await consolidationService.consolidate();
        markConsolidated(ctx.dataDir);
      }
    } catch (err) {
      process.stderr.write(`[agentic-memory] maintenance error: ${err instanceof Error ? err.message : err}\n`);
    }

    const project = detectProject(process.cwd());
    const gitContext = getGitContext();

    const injectionService = new InjectionService({
      memoryRepo: ctx.memoryRepo,
      relationRepo: ctx.relationRepo,
      gitContext: gitContext ?? undefined,
    });

    const result = injectionService.selectForInjection(
      ctx.config.injectionBudget,
      project ?? undefined,
    );

    write(injectionService.formatInjection(result));
  } finally {
    ctx.close();
  }
}
