import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getConfigSnapshot } from "../src/commands/doctor/watcher.js";

describe("doctor watcher snapshots", () => {
  it("changes when a selected Claude file changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-watch-claude-"));
    await writeFile(join(root, "CLAUDE.md"), "# one\n");
    const before = await getConfigSnapshot(root, ["claude"]);
    await writeFile(join(root, "CLAUDE.md"), "# two\n");
    const after = await getConfigSnapshot(root, ["claude"]);
    expect(after).not.toBe(before);
  });

  it("changes when a selected Cursor file changes", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-watch-cursor-"));
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# one\n");
    const before = await getConfigSnapshot(root, ["cursor"]);
    await writeFile(join(root, "AGENTS.md"), "# two\n");
    const after = await getConfigSnapshot(root, ["cursor"]);
    expect(after).not.toBe(before);
  });

  it("does not throw when .cursor is a file instead of a directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-watch-notdir-"));
    await writeFile(join(root, ".cursor"), "not a directory\n");
    await expect(getConfigSnapshot(root, ["cursor"])).resolves.toBeDefined();
  });

  it("ignores Claude files when only Cursor is selected", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-watch-ignore-"));
    await mkdir(join(root, ".claude"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# agents\n");
    await writeFile(join(root, "CLAUDE.md"), "# one\n");
    const before = await getConfigSnapshot(root, ["cursor"]);
    await writeFile(join(root, "CLAUDE.md"), "# two\n");
    await writeFile(join(root, ".claude", "settings.json"), "{}\n");
    const after = await getConfigSnapshot(root, ["cursor"]);
    expect(after).toBe(before);
  });
});
