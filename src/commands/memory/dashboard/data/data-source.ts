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

  /** Get all relations for a specific memory. */
  getRelationsForMemory(id: string): readonly Relation[] {
    return this.#relationRepo.getByMemory(id);
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

  /** Hard-delete a memory by ID. Returns true if deleted. */
  deleteMemory(id: string): boolean {
    return this.#memoryRepo.hardDelete(id);
  }

  /** Delete all memories for a project. Returns number of deleted memories. */
  purgeProject(project: string): number {
    return this.#memoryRepo.deleteByProject(project);
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
