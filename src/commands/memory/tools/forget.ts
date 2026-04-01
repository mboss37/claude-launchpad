import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolDeps } from './register.js';
import { memoryNotFound, formatMcpError } from '../utils/errors.js';

const inputSchema = {
  id: z.string().describe('ID of the memory to forget'),
  hard_delete: z.boolean().default(false).describe('true = permanent delete, false = set importance to 0 (soft delete)'),
};

export function registerForget(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    'memory_forget',
    {
      description:
        'Forget a memory. By default, soft-deletes (sets importance to 0, allowing natural decay). '
        + 'Pass hard_delete=true to permanently remove. Use memory_search to find the ID first.',
      inputSchema,
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    async (args) => {
      const memory = deps.memoryRepo.getById(args.id);
      if (!memory) {
        return formatMcpError(memoryNotFound(args.id));
      }

      if (deps.project && memory.project !== null && memory.project !== deps.project) {
        return formatMcpError({
          what: `Memory ${args.id} belongs to project "${memory.project}".`,
          why: `Current project is "${deps.project}". Cross-project deletion is not allowed.`,
          fix: 'Switch to the correct project or use a global context.',
        });
      }

      if (args.hard_delete) {
        deps.memoryRepo.hardDelete(args.id);
        return {
          content: [{
            type: 'text' as const,
            text: `Permanently deleted memory ${args.id} ("${memory.title ?? memory.content.slice(0, 50)}")`,
          }],
        };
      }

      deps.memoryRepo.softDelete(args.id);
      return {
        content: [{
          type: 'text' as const,
          text: `Soft-deleted memory ${args.id} (importance set to 0, will decay naturally)`,
        }],
      };
    },
  );
}
