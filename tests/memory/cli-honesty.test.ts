import { describe, it, expect, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// WP-043: failure paths must throw (the CLI wrapper converts throws to exit 1).
// A `log.error` + `return` looks successful to every script that checks $?.

vi.mock(
  "../../src/commands/memory/utils/gist-transport.js",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../src/commands/memory/utils/gist-transport.js")
      >();
    return {
      ...actual,
      assertGhAvailable: () => {},
      loadSyncConfig: () => mockSyncConfig,
      readGistFile: () => null,
      updateGistFiles: () => {},
      createGist: () => "gist123",
    };
  },
);

vi.mock("../../src/commands/memory/utils/project.js", () => ({
  detectProject: () => mockProject,
}));

vi.mock("../../src/commands/memory/utils/require-deps.js", () => ({
  requireMemoryDeps: async () => {},
}));

vi.mock("../../src/commands/memory/subcommands/init-storage.js", () => ({
  initStorage: () => ({
    memoryRepo: { getAllForSync: () => [], getTombstonesByProject: () => [] },
    relationRepo: { getAll: () => [] },
    close: () => {},
  }),
}));

let mockSyncConfig: { gistId: string } | null = null;
let mockProject: string | null = null;

describe("sync failure paths exit non-zero (throw)", () => {
  it("runPull throws when no sync gist is configured", async () => {
    mockSyncConfig = null;
    const { runPull } =
      await import("../../src/commands/memory/subcommands/pull.js");
    await expect(runPull({})).rejects.toThrow(/no sync gist/i);
  });

  it("runSyncStatus throws when no sync gist is configured", async () => {
    mockSyncConfig = null;
    const { runSyncStatus } =
      await import("../../src/commands/memory/subcommands/sync-status.js");
    await expect(runSyncStatus()).rejects.toThrow(/no sync gist/i);
  });

  it("runSyncClean throws when no sync gist is configured", async () => {
    mockSyncConfig = null;
    const { runSyncClean } =
      await import("../../src/commands/memory/subcommands/sync-clean.js");
    await expect(runSyncClean("some-project", { yes: true })).rejects.toThrow(
      /no sync gist/i,
    );
  });

  it("runPush throws when the project cannot be detected", async () => {
    mockSyncConfig = { gistId: "gist123" };
    mockProject = null;
    const { runPush } =
      await import("../../src/commands/memory/subcommands/push.js");
    await expect(runPush({ yes: true })).rejects.toThrow(
      /could not detect project/i,
    );
  });
});

describe("memory command surface", () => {
  it("registers stats and doctor as real subcommands", async () => {
    const { createMemoryCommand } =
      await import("../../src/commands/memory/index.js");
    const names = createMemoryCommand().commands.map((c) => c.name());
    expect(names).toContain("stats");
    expect(names).toContain("doctor");
    expect(names).toContain("push");
    expect(names).toContain("pull");
    expect(names).toContain("sync");
  });
});
