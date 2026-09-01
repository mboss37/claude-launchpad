import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { claudeHarnessProfile } from "../src/harness/claude/profile.js";
import { cursorHarnessProfile } from "../src/harness/cursor/profile.js";
import {
  detectHarnesses,
  HARNESS_PROFILES,
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

  it("ignores a .cursor directory that holds no agent configuration", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-harness-ide-"));
    await writeFile(join(root, "CLAUDE.md"), "# Claude");
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, ".cursor", "mcp.json"), "{}\n");
    expect(await detectHarnesses(root)).toEqual(["claude"]);
  });

  it("detects Cursor from hooks.json alone", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-harness-hooks-"));
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(
      join(root, ".cursor", "hooks.json"),
      '{"version":1,"hooks":{}}\n',
    );
    expect(await detectHarnesses(root)).toEqual(["cursor"]);
  });

  it("detects Cursor from AGENTS.md alone", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-harness-agents-"));
    await writeFile(join(root, "AGENTS.md"), "# Agents");
    expect(await detectHarnesses(root)).toEqual(["cursor"]);
  });

  it("wires harness profiles into production detection", async () => {
    expect(HARNESS_PROFILES.claude).toBe(claudeHarnessProfile);
    expect(HARNESS_PROFILES.cursor).toBe(cursorHarnessProfile);
    const root = await mkdtemp(join(tmpdir(), "lp-harness-profiles-"));
    await writeFile(join(root, "CLAUDE.md"), "# Claude");
    await writeFile(join(root, "AGENTS.md"), "# Agents");
    const detected = await detectHarnesses(root);
    const fromProfiles = (
      await Promise.all(
        (["claude", "cursor"] as const).map(async (id) =>
          (await HARNESS_PROFILES[id].detect(root)) ? id : null,
        ),
      )
    ).filter((id): id is "claude" | "cursor" => id !== null);
    expect(detected).toEqual(fromProfiles);
  });

  it("resolves auto to every detected harness", () => {
    expect(resolveHarnesses("auto", ["claude", "cursor"])).toEqual([
      "claude",
      "cursor",
    ]);
  });
});
