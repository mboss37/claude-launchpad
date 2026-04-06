import { z } from 'zod';

// ── Memory Types ──────────────────────────────────────────────

export const MEMORY_TYPES = ['working', 'episodic', 'semantic', 'procedural', 'pattern'] as const;
export type MemoryType = typeof MEMORY_TYPES[number];

export const MEMORY_SOURCES = ['manual', 'session_end', 'consolidation', 'hook', 'import'] as const;
export type MemorySource = typeof MEMORY_SOURCES[number];

export const RELATION_TYPES = [
  'relates_to', 'depends_on', 'contradicts', 'extends', 'implements', 'derived_from',
] as const;
export type RelationType = typeof RELATION_TYPES[number];

// ── Core Entities ─────────────────────────────────────────────

export interface Memory {
  readonly id: string;
  readonly type: MemoryType;
  readonly title: string | null;
  readonly content: string;
  readonly context: string | null;
  readonly source: MemorySource | null;
  readonly project: string | null;
  readonly tags: readonly string[];
  readonly importance: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly accessCount: number;
  readonly lastAccessed: string | null;
  readonly injectionCount: number;
}

export interface Relation {
  readonly sourceId: string;
  readonly targetId: string;
  readonly relationType: RelationType;
  readonly createdAt: string;
}

// ── Search Types ──────────────────────────────────────────────

export interface SearchResult {
  readonly memory: Memory;
  readonly score: number;
  readonly explanation: string;
}

export interface FtsMatch {
  readonly rowid: number;
  readonly memoryId: string;
  readonly rank: number;
}

export interface ScoredCandidate {
  readonly memoryId: string;
  readonly textScore: number;
  readonly importanceScore: number;
  readonly recencyScore: number;
  readonly accessScore: number;
  readonly contextScore: number;
  readonly composite: number;
}

// ── Decay Parameters ──────────────────────────────────────────

export interface DecayParams {
  readonly tauByType: Record<MemoryType, number>;
  readonly accessModifiers: readonly { readonly maxCount: number; readonly multiplier: number }[];
  readonly relationModifier: {
    readonly connectedThreshold: number;
    readonly connectedMultiplier: number;
    readonly isolatedMultiplier: number;
    readonly highlyConnectedThreshold: number;
    readonly highlyConnectedMultiplier: number;
  };
  readonly importanceFloor: number;
  readonly pruneThreshold: number;
  readonly pruneMinAgeDays: number;
}

// ── Input Schemas (for MCP tools) ─────────────────────────────

export const StoreInputSchema = z.object({
  type: z.enum(MEMORY_TYPES),
  content: z.string().min(1).max(2000),
  title: z.string().max(200).optional(),
  tags: z.array(z.string()).max(20).default([]),
  importance: z.number().min(0).max(1).default(0.5),
  context: z.string().optional(),
  source: z.enum(MEMORY_SOURCES).default('manual'),
  project: z.string().max(200).optional(),
});
export type StoreInput = z.infer<typeof StoreInputSchema>;

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(500),
  id: z.string().optional(),
  type: z.enum(MEMORY_TYPES).optional(),
  tags: z.array(z.string()).max(10).optional(),
  limit: z.number().int().min(1).max(50).default(10),
  min_importance: z.number().min(0).max(1).default(0),
  project: z.string().max(200).optional(),
});
export type SearchInput = z.infer<typeof SearchInputSchema>;

export const ForgetInputSchema = z.object({
  id: z.string(),
  hard_delete: z.boolean().default(false),
});
export type ForgetInput = z.infer<typeof ForgetInputSchema>;

export const RelateInputSchema = z.object({
  source_id: z.string(),
  target_id: z.string(),
  relation_type: z.enum(RELATION_TYPES),
});
export type RelateInput = z.infer<typeof RelateInputSchema>;

// ── Sync Types ───────────────────────────────────────────────

export interface SyncPayload {
  readonly version: number;
  readonly machine_id: string;
  readonly pushed_at: string;
  readonly memories: readonly SyncMemoryRow[];
  readonly relations: readonly SyncRelationRow[];
}

export interface SyncMemoryRow {
  readonly id: string;
  readonly type: MemoryType;
  readonly title: string | null;
  readonly content: string;
  readonly context: string | null;
  readonly source: MemorySource | null;
  readonly project: string | null;
  readonly tags: readonly string[];
  readonly importance: number;
  readonly access_count: number;
  readonly injection_count: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly last_accessed: string | null;
}

export interface SyncRelationRow {
  readonly source_id: string;
  readonly target_id: string;
  readonly relation_type: RelationType;
  readonly created_at: string;
}

export const SyncPayloadSchema = z.object({
  version: z.number(),
  machine_id: z.string(),
  pushed_at: z.string(),
  memories: z.array(z.object({
    id: z.string(),
    type: z.enum(MEMORY_TYPES),
    title: z.string().nullable(),
    content: z.string(),
    context: z.string().nullable(),
    source: z.enum(MEMORY_SOURCES).nullable(),
    project: z.string().nullable(),
    tags: z.array(z.string()),
    importance: z.number(),
    access_count: z.number(),
    injection_count: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    last_accessed: z.string().nullable(),
  })),
  relations: z.array(z.object({
    source_id: z.string(),
    target_id: z.string(),
    relation_type: z.enum(RELATION_TYPES),
    created_at: z.string(),
  })),
});

export interface SyncConfig {
  readonly gistId: string;
}

export interface MergeResult {
  readonly inserted: number;
  readonly updated: number;
  readonly relationsAdded: number;
}

// ── Stats ─────────────────────────────────────────────────────

export interface MemoryStats {
  readonly totalMemories: number;
  readonly byType: Record<MemoryType, number>;
  readonly totalRelations: number;
  readonly dbSizeBytes: number;
  readonly oldestMemory: string | null;
  readonly newestMemory: string | null;
  readonly topInjected: readonly { readonly id: string; readonly title: string | null; readonly injectionCount: number }[];
}
