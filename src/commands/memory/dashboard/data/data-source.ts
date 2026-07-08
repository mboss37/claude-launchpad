import { statSync, watchFile, unwatchFile } from "node:fs";
import { join } from "node:path";
import type { MemoryRepo } from "../../storage/memory-repo.js";
import type { RelationRepo } from "../../storage/relation-repo.js";
import type { SearchRepo } from "../../storage/search-repo.js";
import type { Memory, Relation } from "../../types.js";

// -- Types --------------------------------------------------------------------

export interface MemoryFilter {
  readonly type?: string;
  readonly project?: string;
  readonly query?: string;
}

export interface DashboardStats {
  readonly total: number;
  readonly byType: Record<string, number>;
  readonly byProject: Record<string, number>;
  readonly relations: number;
  readonly dbSizeBytes: number;
  readonly oldest: string | null;
  readonly newest: string | null;
}

// -- Data Source --------------------------------------------------------------

export class DashboardDataSource {
  readonly #memoryRepo: MemoryRepo;
  readonly #relationRepo: RelationRepo;
  readonly #searchRepo: SearchRepo;
  readonly #dbPath: string;

  #cachedMemories: readonly Memory[] = [];
  #relationsByMemory: Map<string, Relation[]> = new Map();

  constructor(
    memoryRepo: MemoryRepo,
    relationRepo: RelationRepo,
    searchRepo: SearchRepo,
    dataDir: string,
  ) {
    this.#memoryRepo = memoryRepo;
    this.#relationRepo = relationRepo;
    this.#searchRepo = searchRepo;
    this.#dbPath = join(dataDir, "memory.db");
  }

  /** Re-query all memories from DB and cache them. Excludes soft-deleted (importance=0). */
  refresh(): void {
    this.#cachedMemories = this.#memoryRepo
      .getAll()
      .filter((m) => m.importance > 0);
    // Relations cached per memory so navigation never hits SQLite per keystroke.
    const byMemory = new Map<string, Relation[]>();
    for (const r of this.#relationRepo.getAll()) {
      for (const id of [r.sourceId, r.targetId]) {
        const list = byMemory.get(id) ?? [];
        list.push(r as Relation);
        byMemory.set(id, list);
      }
    }
    this.#relationsByMemory = byMemory;
  }

  /** Return cached memories, optionally filtered by type, project, or FTS query. */
  getMemories(filter?: MemoryFilter): readonly Memory[] {
    if (!filter) return this.#cachedMemories;

    let results: readonly Memory[] = this.#cachedMemories;

    if (filter.type) {
      const t = filter.type;
      results = results.filter((m) => m.type === t);
    }

    if (filter.project) {
      const p = filter.project;
      results = results.filter((m) => m.project === p);
    }

    if (filter.query) {
      const matches = this.#searchRepo.searchFts({
        query: filter.query,
        limit: 100,
      });
      const matchedIds = new Set(matches.map((m) => m.memoryId));
      results = results.filter((m) => matchedIds.has(m.id));
    }

    return results;
  }

  /** Resolve a memory id to its title for relation display (cache-only, no I/O). */
  getMemoryTitle(id: string): string | undefined {
    const m = this.#cachedMemories.find((mem) => mem.id === id);
    return m?.title ?? undefined;
  }

  getRelationsForMemory(id: string): readonly Relation[] {
    return this.#relationsByMemory.get(id) ?? [];
  }

  /** Compute aggregate stats from cached data + DB queries. */
  getStats(): DashboardStats {
    const total = this.#memoryRepo.count();
    const byType = this.#memoryRepo.countByType();
    const relations = this.#relationRepo.count();
    const { oldest, newest } = this.#memoryRepo.dateRange();
    const dbSizeBytes = this.#getDbSize();
    const byProject = this.#computeByProject();

    return { total, byType, byProject, relations, dbSizeBytes, oldest, newest };
  }

  /** Derive unique project names from cached memories. */
  getProjects(): readonly string[] {
    const projects = new Set<string>();
    for (const m of this.#cachedMemories) {
      if (m.project) {
        projects.add(m.project);
      }
    }
    return [...projects].sort();
  }

  /** Watch the DB file for changes (2s polling interval). Only fires on mtime change. */
  startWatching(onChange: () => void): void {
    let lastMtime = 0;
    watchFile(this.#dbPath, { interval: 2000 }, (curr) => {
      const mtime = curr.mtimeMs;
      if (mtime === lastMtime) return;
      lastMtime = mtime;
      this.refresh();
      onChange();
    });
  }

  /** Soft-delete a memory; returns a snapshot for undo (null if not found). */
  deleteMemory(id: string): Memory | null {
    const snapshot = this.#memoryRepo.getById(id);
    if (!snapshot) return null;
    this.#memoryRepo.softDelete(id);
    return snapshot;
  }

  /** Undo a soft delete using the snapshot taken at delete time. */
  restoreMemory(snapshot: Memory): boolean {
    return this.#memoryRepo.restoreImportance(snapshot.id, snapshot.importance, snapshot.baseImportance);
  }

  /** Curation edits from the TUI: explicit re-rate re-anchors the decay base. */
  updateMemory(id: string, updates: { importance?: number; tags?: readonly string[] }): boolean {
    return this.#memoryRepo.updateContent(id, {
      ...(updates.importance !== undefined ? { importance: updates.importance } : {}),
      ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
    }) !== undefined && this.#memoryRepo.getById(id) !== undefined;
  }

  /** Count memories for a project (unfiltered). */
  countByProject(project: string): number {
    return this.#cachedMemories.filter((m) => m.project === project).length;
  }

  /** Delete all memories for a project. Returns number of deleted memories. */
  purgeProject(project: string): number {
    // hardDelete per id so tombstones are written — a purge that skips
    // tombstones resurrects on the next sync pull.
    // Repo-backed (not cache): purge must work pre-refresh and also sweep
    // soft-deleted remnants the cache filters out.
    const ids = this.#memoryRepo
      .getAll()
      .filter((m) => m.project === project)
      .map((m) => m.id);
    let deleted = 0;
    for (const id of ids) {
      if (this.#memoryRepo.hardDelete(id)) deleted++;
    }
    return deleted;
  }

  /** Stop watching the DB file. */
  stopWatching(): void {
    unwatchFile(this.#dbPath);
  }

  // -- Private helpers --------------------------------------------------------

  #getDbSize(): number {
    try {
      return statSync(this.#dbPath).size;
    } catch {
      return 0;
    }
  }

  #computeByProject(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const m of this.#cachedMemories) {
      const key = m.project ?? "(none)";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }
}
