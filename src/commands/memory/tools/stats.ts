import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolDeps } from './register.js';
import { MEMORY_TYPES } from '../types.js';
import type { MemoryStats } from '../types.js';
import { statSync } from 'node:fs';
import { join } from 'node:path';

export function registerStats(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    'memory_stats',
    {
      description:
        'See how much is in the knowledge base — total count, breakdown by type, storage size, and most-used memories.',
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      const countByType = deps.memoryRepo.countByType();
      const total = deps.memoryRepo.count();
      const topInjected = deps.memoryRepo.topInjected(5);
      const totalRelations = deps.relationRepo.count();

      let dbSizeBytes = 0;
      try {
        const dbPath = join(deps.dataDir, 'memory.db');
        dbSizeBytes = statSync(dbPath).size;
      } catch {
        // :memory: or file not found
      }

      const { oldest, newest } = deps.memoryRepo.dateRange();

      const stats: MemoryStats = {
        totalMemories: total,
        byType: Object.fromEntries(
          MEMORY_TYPES.map(t => [t, countByType[t] ?? 0])
        ) as Record<string, number>,
        totalRelations,
        dbSizeBytes,
        oldestMemory: oldest,
        newestMemory: newest,
        topInjected,
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(stats, null, 2),
        }],
      };
    },
  );
}
