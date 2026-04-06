import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolDeps } from './register.js';
import { MEMORY_TYPES, MEMORY_SOURCES } from '../types.js';
import { getGitContext } from '../utils/git-context.js';
import { validateMemoryContent } from '../utils/content-validation.js';
import { checkContradiction } from '../utils/contradiction.js';

// In-memory dedup: content hash → timestamp. Catches parallel calls within same request.
const recentStores = new Map<string, number>();
const DEDUP_WINDOW_MS = 10_000;

const inputSchema = {
  type: z.enum(MEMORY_TYPES).describe('Memory type: working, episodic, semantic, procedural, or pattern'),
  content: z.string().min(1).max(2000).describe('The memory content (max 2000 chars / ~500 tokens). Keep memories concise: capture the decision or insight, not the full context. Split large topics into separate memories.'),
  title: z.string().max(200).optional().describe('Short title for the memory'),
  tags: z.array(z.string()).max(20).default([]).describe('Tags for categorization. Suggested: #bug, #decision, #gotcha, #howto, #pattern'),
  importance: z.number().min(0).max(1).default(0.5).describe('0-0.3 ephemeral, 0.3-0.6 reference, 0.6-0.8 important, 0.8-1.0 critical'),
  context: z.string().optional().describe('JSON: {"files": [...], "branch": "...", "intent": "..."}. Auto-detected from git if omitted.'),
  source: z.enum(MEMORY_SOURCES).default('manual').describe('How this memory was created'),
  project: z.string().max(200).optional().describe('Project scope (auto-detected from CWD if omitted)'),
};

export function registerStore(server: McpServer, deps: ToolDeps): void {
  server.registerTool(
    'memory_store',
    {
      description:
        'Store a new memory. Use memory_search first to check for duplicates. '
        + 'Prefer updating existing semantic/procedural memories over creating new ones. '
        + 'Types: episodic (events), semantic (facts), procedural (how-to), pattern (recurring), working (temporary). '
        + 'Importance: 0-0.3 ephemeral, 0.3-0.6 reference, 0.6-0.8 important, 0.8-1.0 critical. '
        + 'Suggested tags: #bug, #decision, #gotcha, #howto, #pattern, #architecture. '
        + 'Context is auto-detected from git (branch, recent files) if omitted.',
      inputSchema,
      annotations: { idempotentHint: false },
    },
    async (args) => {
      const validation = validateMemoryContent(args.content);
      if (!validation.valid) {
        return {
          content: [{
            type: 'text' as const,
            text: `Rejected: ${validation.reason}`,
          }],
          isError: true,
        };
      }

      const context = args.context ?? JSON.stringify(getGitContext());
      const project = args.project ?? deps.project ?? undefined;

      // Dedup: in-memory guard catches parallel calls within same request
      const contentHash = createHash('sha256').update(args.content).digest('hex');
      const now = Date.now();
      const lastStored = recentStores.get(contentHash);
      if (lastStored && (now - lastStored) < DEDUP_WINDOW_MS) {
        return {
          content: [{ type: 'text' as const, text: 'Duplicate: identical memory was just stored. Skipped.' }],
        };
      }
      recentStores.set(contentHash, now);
      // Prune old entries
      for (const [key, ts] of recentStores) {
        if (now - ts > DEDUP_WINDOW_MS) recentStores.delete(key);
      }

      // Contradiction detection
      const contradictions: { id: string; title: string | null }[] = [];
      try {
        const existing = await deps.retrievalService.search({
          query: args.content.slice(0, 200),
          limit: 3,
          min_importance: 0,
          project,
        });
        for (const result of existing) {
          if (result.score > 0.6 && checkContradiction(args.content, result.memory.content)) {
            contradictions.push({ id: result.memory.id, title: result.memory.title });
          }
        }
      } catch {
        // Contradiction check is best-effort
      }

      const memory = deps.memoryRepo.create(
        {
          type: args.type,
          content: args.content,
          title: args.title,
          tags: args.tags,
          importance: args.importance,
          context,
          source: args.source,
          project,
        },
        null,
      );

      // Create contradiction relations
      for (const c of contradictions) {
        try {
          deps.relationRepo.create(memory.id, c.id, 'contradicts');
        } catch {
          // Relation creation is best-effort
        }
      }

      const parts: string[] = [
        `Stored memory ${memory.id} (type: ${memory.type}, importance: ${memory.importance})`,
      ];

      for (const warning of validation.warnings) {
        parts.push(`Warning: ${warning}`);
      }

      for (const c of contradictions) {
        parts.push(`Warning: potential contradiction with memory ${c.id}${c.title ? ` ("${c.title}")` : ''}. Linked with 'contradicts' relation.`);
      }

      return {
        content: [{
          type: 'text' as const,
          text: parts.join('\n'),
        }],
      };
    },
  );
}
