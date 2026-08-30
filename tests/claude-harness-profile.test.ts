import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { claudeHarnessProfile } from "../src/harness/claude/profile.js";

describe("claude harness profile", () => {
  it("detects and parses the existing Claude surface without translation", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-claude-profile-"));
    await writeFile(join(root, "CLAUDE.md"), "# Demo\n- Run tests");
    expect(await claudeHarnessProfile.detect(root)).toBe(true);
    const config = await claudeHarnessProfile.parse(root);
    expect(config.claudeMdContent).toContain("Run tests");
  });
});
