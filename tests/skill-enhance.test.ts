import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateEnhanceSkill, ENHANCE_SKILL_VERSION } from "../src/commands/init/generators/skill-enhance.js";

/**
 * Guards against changing skill content without bumping the version.
 * If this test fails, you changed the skill content — bump ENHANCE_SKILL_VERSION
 * and update the hash below.
 */
const KNOWN_HASHES: Record<number, string> = {
  7: "bfdefb48ec360626",
  8: "7fe8e50e8d37a20f",
};

describe("lp-enhance skill", () => {
  it("version matches content hash (bump version if content changed)", () => {
    const content = generateEnhanceSkill();
    const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);

    const knownHash = KNOWN_HASHES[ENHANCE_SKILL_VERSION];
    if (!knownHash || knownHash === "PLACEHOLDER") {
      // First run for this version — print the hash to paste in
      console.log(`\n  Skill v${ENHANCE_SKILL_VERSION} hash: "${hash}"\n  Paste this into KNOWN_HASHES in tests/skill-enhance.test.ts\n`);
      expect(knownHash).not.toBe("PLACEHOLDER");
    }

    expect(hash).toBe(knownHash);
  });

  it("generates valid frontmatter", () => {
    const content = generateEnhanceSkill();
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("name: lp-enhance");
    expect(content).toContain("allowed-tools:");
    expect(content).toContain("argument-hint:");
  });

  it("includes version comment", () => {
    const content = generateEnhanceSkill();
    expect(content).toContain(`lp-enhance-version: ${ENHANCE_SKILL_VERSION}`);
  });

  it("includes local config steps in research phase", () => {
    const content = generateEnhanceSkill();
    expect(content).toContain(".claude/CLAUDE.md");
    expect(content).toContain(".claude/settings.local.json");
  });

  it("includes skill authoring conventions", () => {
    const content = generateEnhanceSkill();
    expect(content).toContain("Skill Authoring");
    expect(content).toContain("500 lines");
    expect(content).toContain("disable-model-invocation");
  });
});
