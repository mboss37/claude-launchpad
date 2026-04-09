import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolDeps } from './register.js';
import { MEMORY_TYPES } from '../types.js';

const inputSchema = {
  limit: z.number().int().min(1).max(50).default(10).describe('Maximum memories to return'),
  type: z.enum(MEMORY_TYPES).optional().describe('Filter by memory type'),
  project: z.string().max(200).optional().describe('Project scope. Omit for current project + global memories (default). Pass "*" for ALL projects. Pass a project name for that specific project.'),
};

export function registerRecent(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    'memory_recent',
    {
      description:
        'Get caught up on what happened before this session. '
        + 'Returns memories relevant to the current branch/files, recent activity, and related context. '
        + 'Typically called at session start to restore working context. No query needed — it uses git state to find what matters. '
        + 'Project scoping: by default, returns memories for the current project + global memories. '
        + 'Pass project="*" to include all projects.',
      inputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args) => {
      const project = args.project === '*'
        ? undefined
        : (args.project ?? deps.project ?? undefined);

      const results = deps.retrievalService.loadSessionContext({
        limit: args.limit,
        project,
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
