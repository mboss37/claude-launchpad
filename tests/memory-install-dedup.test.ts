import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { injectClaudeMdGuidance } from "../src/commands/memory/subcommands/install.js";

describe("injectClaudeMdGuidance — memory install dedup (regression for v1.10.0 D.1)", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `mem-install-dedup-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  it("is idempotent when CLAUDE.md already contains `## Memory (agentic-memory)`", async () => {
    const original = "# Test\n\n## Memory (agentic-memory)\n- existing canonical block\n";
    await writeFile(join(testDir, "CLAUDE.md"), original);

    const result = injectClaudeMdGuidance(testDir, "shared");
    expect(result).toBe(false);

    const after = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
    expect(after).toBe(original);
  });

  it("does NOT append a second block when CLAUDE.md has bare `## Memory` (the v1.10.0 bug)", async () => {
    // Before v1.10.0: `/lp-enhance` wrote bare `## Memory`, install looked for
    // `## Memory (agentic-memory)` exact-substring, missed the bare heading,
    // and appended a second block. Regression guard for the regex fix.
    const original = "# Test\n\n## Memory\n- block written by /lp-enhance\n";
    await writeFile(join(testDir, "CLAUDE.md"), original);

    const result = injectClaudeMdGuidance(testDir, "shared");
    expect(result).toBe(false);

    const after = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
    expect(after).toBe(original);
    expect((after.match(/^## Memory/gm) ?? []).length).toBe(1);
  });

  it("appends the canonical block when no Memory heading exists", async () => {
    const original = "# Test\n\n## Stack\n- TS\n";
    await writeFile(join(testDir, "CLAUDE.md"), original);

    const result = injectClaudeMdGuidance(testDir, "shared");
    expect(result).toBe(true);

    const after = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
    expect(after).toContain("## Memory (agentic-memory)");
    expect(after).toContain("## Stack");
  });

  it("does NOT match `## Memory Management` (false-positive guard on the anchored regex)", async () => {
    const original = "# Test\n\n## Memory Management\n- unrelated section\n";
    await writeFile(join(testDir, "CLAUDE.md"), original);

    const result = injectClaudeMdGuidance(testDir, "shared");
    expect(result).toBe(true);

    const after = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
    expect(after).toContain("## Memory Management");
    expect(after).toContain("## Memory (agentic-memory)");
  });

  it("running injectClaudeMdGuidance twice is a no-op on the second call", async () => {
    await writeFile(join(testDir, "CLAUDE.md"), "# Test\n");

    const first = injectClaudeMdGuidance(testDir, "shared");
    const second = injectClaudeMdGuidance(testDir, "shared");
    expect(first).toBe(true);
    expect(second).toBe(false);

    const after = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
    expect((after.match(/^## Memory \(agentic-memory\)/gm) ?? []).length).toBe(1);
  });
});
