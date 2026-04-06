import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolDeps } from './register.js';

const inputSchema = {
  id: z.string().describe('Memory ID to update (use memory_search to find it)'),
  title: z.string().max(200).optional().describe('Updated title'),
  content: z.string().min(1).max(10000).optional().describe('Updated content'),
  tags: z.array(z.string()).max(20).optional().describe('Updated tags'),
  importance: z.number().min(0).max(1).optional().describe('Updated importance (0-1)'),
  context: z.string().optional().describe('Updated context JSON'),
};

export function registerUpdate(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    'memory_update',
    {
      description:
        'Correct or improve an existing memory instead of creating a duplicate. '
        + 'Use when information has changed, a decision was revised, or a memory needs more detail. '
        + 'Keeps the memory\'s history intact. Use memory_search to find the ID first.',
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async (args) => {
      const hasUpdate = args.title !== undefined || args.content !== undefined
        || args.tags !== undefined || args.importance !== undefined
        || args.context !== undefined;

      if (!hasUpdate) {
        return {
          content: [{ type: 'text' as const, text: 'No fields to update. Provide at least one of: title, content, tags, importance, context.' }],
          isError: true,
        };
      }

      const existing = deps.memoryRepo.getById(args.id);
      if (!existing) {
        return {
          content: [{ type: 'text' as const, text: `Memory ${args.id} not found.` }],
          isError: true,
        };
      }

      const updated = deps.memoryRepo.updateContent(args.id, {
        title: args.title,
        content: args.content,
        tags: args.tags,
        importance: args.importance,
        context: args.context,
      });

      if (!updated) {
        return {
          content: [{ type: 'text' as const, text: `Failed to update memory ${args.id}.` }],
          isError: true,
        };
      }

      const fields = [
        args.title !== undefined && 'title',
        args.content !== undefined && 'content',
        args.tags !== undefined && 'tags',
        args.importance !== undefined && 'importance',
        args.context !== undefined && 'context',
      ].filter(Boolean).join(', ');

      return {
        content: [{ type: 'text' as const, text: `Updated memory ${args.id} (fields: ${fields})` }],
      };
    },
  );
}
