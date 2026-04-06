import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolDeps } from './register.js';
import { MEMORY_TYPES } from '../types.js';

const inputSchema = {
  limit: z.number().int().min(1).max(50).default(10).describe('Maximum memories to return'),
  type: z.enum(MEMORY_TYPES).optional().describe('Filter by memory type'),
};

export function registerRecent(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    'memory_recent',
    {
      description:
        'Load session context: returns context-matched, recent, and related memories. '
        + 'Call this at the start of every session to load context from previous work. '
        + 'Results are grouped into sections: contextMatched (matching current branch/files), '
        + 'recent (most recent), and related (connected via relations).',
      inputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args) => {
      const results = deps.retrievalService.loadSessionContext({
        limit: args.limit,
        project: deps.project ?? undefined,
        type: args.type,
      });

      if (results.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No memories found for this project.' }],
        };
      }

      const formatEntry = (entry: typeof results[number], rank: number) => ({
        rank,
        section: entry.section,
        id: entry.result.memory.id,
        type: entry.result.memory.type,
        title: entry.result.memory.title,
        content: entry.result.memory.content,
        importance: entry.result.memory.importance,
        tags: entry.result.memory.tags,
        score: Math.round(entry.result.score * 100) / 100,
        explanation: entry.result.explanation,
        createdAt: entry.result.memory.createdAt,
      });

      const contextMatched = results.filter(r => r.section === 'context').map((r, i) => formatEntry(r, i + 1));
      const recent = results.filter(r => r.section === 'recent').map((r, i) => formatEntry(r, i + 1));
      const related = results.filter(r => r.section === 'related').map((r, i) => formatEntry(r, i + 1));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ contextMatched, recent, related }, null, 2),
        }],
      };
    },
  );
}
