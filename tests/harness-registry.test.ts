import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectHarnesses,
  parseHarnessSelection,
  resolveHarnesses,
} from "../src/harness/registry.js";

describe("harness registry", () => {
  it.each(["auto", "claude", "cursor", "both"] as const)(
    "accepts %s",
    (value) => expect(parseHarnessSelection(value)).toBe(value),
  );

  it("rejects unknown harnesses with an actionable error", () => {
    expect(() => parseHarnessSelection("vscode")).toThrow(
      "Harness must be one of: auto, claude, cursor, both",
    );
  });

  it("detects Claude and Cursor independently", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-harness-"));
    await writeFile(join(root, "CLAUDE.md"), "# Claude");
    await mkdir(join(root, ".cursor", "rules"), { recursive: true });
    await writeFile(
      join(root, ".cursor", "rules", "core.mdc"),
      "---\nalwaysApply: true\n---\n",
    );
    expect(await detectHarnesses(root)).toEqual(["claude", "cursor"]);
  });

  it("resolves auto to every detected harness", () => {
    expect(resolveHarnesses("auto", ["claude", "cursor"])).toEqual([
      "claude",
      "cursor",
    ]);
  });
});
