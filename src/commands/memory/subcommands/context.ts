import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RetrievalService } from '../services/retrieval-service.js';
import { DecayService } from '../services/decay-service.js';
import { ConsolidationService } from '../services/consolidation-service.js';
import { detectProject } from '../utils/project.js';
import { initStorage } from './init-storage.js';
import type { MemoryType } from '../types.js';

interface ContextOpts {
  readonly json?: boolean;
  readonly type?: string;
  readonly limit?: number;
  readonly dbPath?: string;
}

const FULL_INJECT_THRESHOLD = 10;
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

    const retrievalService = new RetrievalService({
      memoryRepo: ctx.memoryRepo,
      relationRepo: ctx.relationRepo,
      searchRepo: ctx.searchRepo,
    });

    const project = detectProject(process.cwd());
    const totalCount = ctx.memoryRepo.count(project ?? undefined);

    const results = retrievalService.loadSessionContext({
      limit: opts.limit ?? FULL_INJECT_THRESHOLD,
      project: project ?? undefined,
      type: opts.type as MemoryType | undefined,
    });

    if (results.length === 0) {
      write('No memories found for this project.');
      return;
    }

    const useGraph = totalCount > FULL_INJECT_THRESHOLD;

    if (opts.json) {
      write('# Agentic Memory - Session Context');
      if (useGraph) {
        write(`${totalCount} memories stored. Showing index only - use memory_search to get full content.\n`);
        const graph = results.map(r => formatGraphEntry(r));
        write(JSON.stringify({ mode: 'graph', totalMemories: totalCount, memories: graph }, null, 2));
      } else {
        write('The following memories were loaded from previous sessions. Treat these as known facts.');
        write('When the user asks about something covered here, answer from these memories directly.\n');
        const sections = {
          contextMatched: results.filter(r => r.section === 'context').map(formatFullEntry),
          recent: results.filter(r => r.section === 'recent').map(formatFullEntry),
          related: results.filter(r => r.section === 'related').map(formatFullEntry),
        };
        write(JSON.stringify({ mode: 'full', ...sections }, null, 2));
      }
    } else {
      write(`agentic-memory - Session context (${results.length}/${totalCount} memories)\n`);
      for (const r of results) {
        const m = r.result.memory;
        write(`  ${m.title ?? '(untitled)'} [${m.type}] - ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`);
      }
    }
  } finally {
    ctx.close();
  }
}

interface ContextEntry {
  readonly section: string;
  readonly result: {
    readonly memory: {
      readonly id: string;
      readonly type: string;
      readonly title: string | null;
      readonly content: string;
      readonly importance: number;
      readonly tags: readonly string[];
      readonly createdAt: string;
    };
    readonly score: number;
    readonly explanation: string;
  };
}

function formatFullEntry(entry: ContextEntry) {
  const m = entry.result.memory;
  return {
    id: m.id,
    type: m.type,
    title: m.title,
    content: m.content.slice(0, 500),
    importance: m.importance,
    tags: m.tags,
    score: Math.round(entry.result.score * 100) / 100,
    createdAt: m.createdAt,
  };
}

function formatGraphEntry(entry: ContextEntry) {
  const m = entry.result.memory;
  return {
    id: m.id,
    type: m.type,
    title: m.title,
    importance: m.importance,
    tags: m.tags,
    section: entry.section,
  };
}
