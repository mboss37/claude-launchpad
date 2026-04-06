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
const pendingStores = new Set<string>();
const DEDUP_WINDOW_MS = 10_000;

// Tag normalization: lowercase, strip #, singularize common suffixes, apply aliases
const TAG_ALIASES: Record<string, string> = {
  bugs: 'bug', bugfix: 'bug', debugging: 'bug',
  decisions: 'decision', decided: 'decision',
  gotchas: 'gotcha', pitfall: 'gotcha', pitfalls: 'gotcha',
  howtos: 'howto', 'how-to': 'howto',
  patterns: 'pattern',
  todos: 'todo', fixme: 'todo',
  architectures: 'architecture', arch: 'architecture',
};

function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((t) => {
    const stripped = t.replace(/^#/, '').toLowerCase().trim();
    return TAG_ALIASES[stripped] ?? stripped;
  }).filter(Boolean))];
}

// Auto-tag: detect common patterns in content
const AUTO_TAG_PATTERNS: readonly { readonly pattern: RegExp; readonly tag: string }[] = [
  { pattern: /\b(bug|crash|error|fix(ed)?|broke)\b/i, tag: 'bug' },
  { pattern: /\b(decid|chose|decision|went with|picked)\b/i, tag: 'decision' },
  { pattern: /\b(gotcha|careful|watch out|trap|pitfall)\b/i, tag: 'gotcha' },
  { pattern: /\b(how to|steps to|run|install|deploy|command)\b/i, tag: 'howto' },
  { pattern: /\b(pattern|recurring|always|every time)\b/i, tag: 'pattern' },
];

function autoTag(content: string, existingTags: readonly string[]): string[] {
  const existing = new Set(existingTags);
  const detected: string[] = [];
  for (const { pattern, tag } of AUTO_TAG_PATTERNS) {
    if (!existing.has(tag) && pattern.test(content)) {
      detected.push(tag);
    }
  }
  return detected;
}

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
        + 'Context is auto-detected from git (branch, recent files) if omitted. '
        + 'NOTE: A built-in dedup guard prevents identical content from being stored twice within 10 seconds. '
        + 'If you see "Skipped" responses, the memory was likely already stored by a parallel call. '
        + 'This is expected behavior, not an error. The data is saved correctly.',
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

      // Dedup: in-memory guard catches parallel calls within same request.
      // Uses a pending Set to catch calls that arrive in the same tick.
      const contentHash = createHash('sha256').update(args.content).digest('hex');
      const now = Date.now();
      const lastStored = recentStores.get(contentHash);
      if (lastStored && (now - lastStored) < DEDUP_WINDOW_MS) {
        return {
          content: [{ type: 'text' as const, text: 'Skipped: identical memory already exists (stored moments ago).' }],
        };
      }
      if (pendingStores.has(contentHash)) {
        return {
          content: [{ type: 'text' as const, text: 'Skipped: identical memory is being stored by another call.' }],
        };
      }
      pendingStores.add(contentHash);
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

      // Normalize tags + auto-tag from content
      const normalizedTags = normalizeTags(args.tags);
      const autoTags = autoTag(args.content, normalizedTags);
      const finalTags = [...new Set([...normalizedTags, ...autoTags])];

      const memory = deps.memoryRepo.create(
        {
          type: args.type,
          content: args.content,
          title: args.title,
          tags: finalTags,
          importance: args.importance,
          context,
          source: args.source,
          project,
        },
        null,
      );

      // Mark as stored (dedup window starts now)
      recentStores.set(contentHash, Date.now());
      pendingStores.delete(contentHash);

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
