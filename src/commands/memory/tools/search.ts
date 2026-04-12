import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolDeps } from './register.js';
import { MEMORY_TYPES, coerceStringArray } from '../types.js';

const inputSchema = {
  query: z.string().min(1).max(500).describe('Search query (natural language or keywords)'),
  id: z.string().optional().describe('Direct lookup by memory ID (bypasses search)'),
  type: z.enum(MEMORY_TYPES).optional().describe('Filter by memory type'),
  tags: coerceStringArray.pipe(z.array(z.string()).max(10)).optional().describe('Filter to memories containing ALL of these tags'),
  limit: z.number().int().min(1).max(50).default(10).describe('Maximum results to return'),
  min_importance: z.number().min(0).max(1).default(0).describe('Minimum importance threshold'),
  project: z.string().max(200).optional().describe('Project scope. Omit to search current project + global memories (default). Pass "*" to search ALL projects. Pass a project name to search that specific project + global memories.'),
};

export function registerSearch(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    'memory_search',
    {
      description:
        'Look up what you already know. Query the knowledge base before solving a problem or storing new information. '
        + 'Use when: checking if something was already decided, finding how-to steps, recalling past bugs, or deduping before a store. '
        + 'Related memories are surfaced automatically. Pass `id` for direct lookup, or filter by `type` and `tags`. '
        + 'Project scoping: by default, returns memories for the current project + global (unscoped) memories. '
        + 'Pass project="*" to search across all projects. Pass a specific project name to search that project instead.',
      inputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args) => {
      // Project scoping: explicit param > auto-detected > undefined
      // "*" means search all projects (no project filter)
      const project = args.project === '*'
        ? undefined
        : (args.project ?? deps.project ?? undefined);

      const results = await deps.retrievalService.search({
        query: args.query,
        id: args.id,
        type: args.type,
        tags: args.tags,
        limit: args.limit,
        min_importance: args.min_importance,
        project,
      });

      if (results.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'No memories found matching your query.' }],
        };
      }

      const formatted = results.map((r, i) => ({
        rank: i + 1,
        id: r.memory.id,
        type: r.memory.type,
        title: r.memory.title,
        content: r.memory.content,
        score: Math.round(r.score * 100) / 100,
        explanation: r.explanation,
        importance: r.memory.importance,
        tags: r.memory.tags,
        accessCount: r.memory.accessCount,
        createdAt: r.memory.createdAt,
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(formatted, null, 2),
        }],
      };
    },
  );
}
