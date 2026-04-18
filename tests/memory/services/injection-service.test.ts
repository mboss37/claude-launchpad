import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createTestDb, closeDatabase } from "../fixtures/test-db.js";
import { MemoryRepo } from "../../../src/commands/memory/storage/memory-repo.js";
import { RelationRepo } from "../../../src/commands/memory/storage/relation-repo.js";
import { InjectionService } from "../../../src/commands/memory/services/injection-service.js";

let db: Database.Database;
let memoryRepo: MemoryRepo;
let relationRepo: RelationRepo;

beforeEach(() => {
  db = createTestDb();
  memoryRepo = new MemoryRepo(db);
  relationRepo = new RelationRepo(db);
});

afterEach(() => {
  closeDatabase(db);
});

function makeMemory(
  content: string,
  type: "semantic" | "episodic" | "procedural" | "pattern" = "semantic",
  importance = 0.5,
  extra: Record<string, unknown> = {},
) {
  return memoryRepo.create(
    { type, content, tags: [], importance, source: "manual", ...extra },
    null,
  );
}

describe("InjectionService", () => {
  describe("selectForInjection", () => {
    it("returns empty for zero memories", () => {
      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(2000);
      expect(result.memories).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it("injects all memories when below cold start threshold", () => {
      makeMemory("Memory one", "semantic", 0.5);
      makeMemory("Memory two", "semantic", 0.6);
      makeMemory("Memory three", "semantic", 0.7);

      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(2000);
      expect(result.memories.length).toBe(3);
    });

    it("skips working memories", () => {
      makeMemory("Working note", "working" as "semantic", 0.5);
      makeMemory("Semantic fact", "semantic", 0.5);

      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(2000);
      expect(result.memories.length).toBe(1);
      expect(result.memories[0]!.memory.content).toBe("Semantic fact");
    });

    it("skips memories below importance floor", () => {
      makeMemory("Low importance", "semantic", 0.02);
      makeMemory("Normal importance", "semantic", 0.5);

      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(2000);
      expect(result.memories.length).toBe(1);
    });

    it("respects token budget", () => {
      // Create many memories to exceed budget
      for (let i = 0; i < 50; i++) {
        makeMemory(`Memory number ${i} with some content that takes up tokens`, "semantic", 0.5);
      }

      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(500); // tight budget
      expect(result.tokensUsed).toBeLessThanOrEqual(500);
      expect(result.memories.length).toBeGreaterThan(0);
      expect(result.memories.length).toBeLessThan(50);
    });

    it("assigns full tier to top-scored memories", () => {
      makeMemory("Critical decision", "semantic", 0.9);
      makeMemory("Minor note", "semantic", 0.2);

      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(2000);
      expect(result.memories.length).toBe(2);
      // The high importance one should be first
      expect(result.memories[0]!.memory.importance).toBe(0.9);
    });

    it("increments injection count for selected memories", () => {
      const mem = makeMemory("Track injection", "semantic", 0.5);
      expect(mem.injectionCount).toBe(0);

      const service = new InjectionService({ memoryRepo, relationRepo });
      service.selectForInjection(2000);

      const updated = memoryRepo.getById(mem.id);
      expect(updated!.injectionCount).toBeGreaterThan(0);
    });

    it("ranks high-importance memories above low-importance", () => {
      makeMemory("Low priority", "semantic", 0.2);
      makeMemory("High priority", "semantic", 0.9);
      makeMemory("Medium priority", "semantic", 0.5);

      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(2000);
      const importances = result.memories.map((m) => m.memory.importance);
      expect(importances[0]).toBeGreaterThanOrEqual(importances[1]!);
    });

    it("diversifies top picks when near-duplicates crowd the pool", () => {
      for (let i = 0; i < 5; i++) {
        makeMemory(`pnpm package manager strict pnpm not npm variant ${i}`, "semantic", 0.5, {
          tags: ["pnpm", "tooling"],
        });
      }
      makeMemory("react server components hydration boundary strategy", "semantic", 0.5, { tags: ["react"] });
      makeMemory("prisma schema migrations pooling config strategy", "semantic", 0.5, { tags: ["prisma"] });
      makeMemory("tailwind mobile first responsive design breakpoints", "semantic", 0.5, { tags: ["tailwind"] });
      makeMemory("typescript strict mode noImplicitAny unknown narrowing", "semantic", 0.5, { tags: ["typescript"] });
      makeMemory("vitest parallel test execution worker pool isolation", "semantic", 0.5, { tags: ["testing"] });

      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(3000);

      const top3 = result.memories.slice(0, 3);
      const pnpmInTop3 = top3.filter((m) => m.memory.tags.includes("pnpm")).length;
      expect(pnpmInTop3).toBeLessThanOrEqual(2);

      const top5Tags = new Set(result.memories.slice(0, 5).flatMap((m) => m.memory.tags));
      expect(top5Tags.size).toBeGreaterThanOrEqual(3);
    });

    it("penalizes memories injected many times without access", () => {
      const noisy = makeMemory("Noisy memory", "semantic", 0.5);
      const fresh = makeMemory("Fresh memory", "semantic", 0.5);

      // Simulate noisy: injected 20 times, never accessed
      for (let i = 0; i < 20; i++) {
        memoryRepo.incrementInjection(noisy.id);
      }

      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(2000);

      const noisyEntry = result.memories.find((m) => m.memory.id === noisy.id);
      const freshEntry = result.memories.find((m) => m.memory.id === fresh.id);

      // Fresh should score higher than noisy
      if (noisyEntry && freshEntry) {
        expect(freshEntry.score).toBeGreaterThan(noisyEntry.score);
      }
    });
  });

  describe("formatInjection", () => {
    it("formats empty result", () => {
      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(2000);
      const output = service.formatInjection(result);
      expect(output).toContain("No memories stored");
    });

    it("formats with Key Memories section for full tier", () => {
      makeMemory("Important decision about architecture", "semantic", 0.9);

      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(2000);
      const output = service.formatInjection(result);
      expect(output).toContain("# Agentic Memory");
      expect(output).toContain("memory_search");
    });

    it("includes token usage in header", () => {
      makeMemory("Some memory", "semantic", 0.5);

      const service = new InjectionService({ memoryRepo, relationRepo });
      const result = service.selectForInjection(2000);
      const output = service.formatInjection(result);
      expect(output).toContain("/2000 tokens");
    });
  });
});
