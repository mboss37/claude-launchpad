import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolDeps } from './register.js';
import { RELATION_TYPES } from '../types.js';
import { memoryNotFound, formatMcpError } from '../utils/errors.js';

const inputSchema = {
  source_id: z.string().describe('ID of the source memory'),
  target_id: z.string().describe('ID of the target memory'),
  relation_type: z.enum(RELATION_TYPES).describe(
    'Type of relation: relates_to, depends_on, contradicts, extends, implements, derived_from'
  ),
};

export function registerRelate(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    'memory_relate',
    {
      description:
        'Create a typed relation between two memories. '
        + 'Relations affect retrieval ranking (connected memories decay slower). '
        + 'Types: relates_to, depends_on, contradicts, extends, implements, derived_from.',
      inputSchema,
      annotations: { idempotentHint: true },
    },
    async (args) => {
      if (args.source_id === args.target_id) {
        return formatMcpError({
          what: 'Cannot create self-relation.',
          why: 'source_id and target_id are the same memory.',
          fix: 'Provide two different memory IDs.',
        });
      }

      const source = deps.memoryRepo.getById(args.source_id);
      if (!source) {
        return formatMcpError(memoryNotFound(args.source_id));
      }

      const target = deps.memoryRepo.getById(args.target_id);
      if (!target) {
        return formatMcpError(memoryNotFound(args.target_id));
      }

      if (deps.project) {
        for (const mem of [source, target]) {
          if (mem.project !== null && mem.project !== deps.project) {
            return formatMcpError({
              what: `Memory ${mem.id} belongs to project "${mem.project}".`,
              why: `Current project is "${deps.project}". Cross-project relations are not allowed.`,
              fix: 'Both memories must belong to the same project.',
            });
          }
        }
      }

      const created = deps.relationRepo.create(args.source_id, args.target_id, args.relation_type);

      if (!created) {
        return {
          content: [{
            type: 'text' as const,
            text: `Relation already exists: ${args.source_id} --[${args.relation_type}]--> ${args.target_id}`,
          }],
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Created relation: "${source.title ?? source.content.slice(0, 40)}" --[${args.relation_type}]--> "${target.title ?? target.content.slice(0, 40)}"`,
        }],
      };
    },
  );
}
