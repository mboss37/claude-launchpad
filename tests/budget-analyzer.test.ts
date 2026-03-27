import { describe, it, expect } from "vitest";
import { analyzeBudget } from "../src/commands/doctor/analyzers/budget.js";
import type { ClaudeConfig } from "../src/types/index.js";

function makeConfig(overrides: Partial<ClaudeConfig> = {}): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: "- instruction one\n- instruction two\n",
    claudeMdInstructionCount: 2,
    settingsPath: null,
    settings: null,
    hooks: [],
    rules: [],
    mcpServers: [],
    skills: [],
    ...overrides,
  };
}

describe("analyzeBudget", () => {
  it("returns score 100 for low instruction count", async () => {
    const result = await analyzeBudget(makeConfig({ claudeMdInstructionCount: 50 }));
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("returns high severity for count over 150", async () => {
    const result = await analyzeBudget(makeConfig({ claudeMdInstructionCount: 160 }));
    expect(result.issues.some((i) => i.severity === "high")).toBe(true);
    expect(result.score).toBeLessThan(70);
  });

  it("returns critical for count over 200", async () => {
    const result = await analyzeBudget(makeConfig({ claudeMdInstructionCount: 250 }));
    expect(result.issues.some((i) => i.severity === "critical")).toBe(true);
    expect(result.score).toBeLessThan(30);
  });

  it("returns medium for approaching budget (120-150)", async () => {
    const result = await analyzeBudget(makeConfig({ claudeMdInstructionCount: 130 }));
    expect(result.issues.some((i) => i.severity === "medium")).toBe(true);
  });

  it("reports missing CLAUDE.md as high severity", async () => {
    const result = await analyzeBudget(makeConfig({
      claudeMdContent: null,
      claudeMdPath: null,
      claudeMdInstructionCount: 0,
    }));
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe("high");
  });

  it("reports empty CLAUDE.md as medium severity", async () => {
    const result = await analyzeBudget(makeConfig({
      claudeMdContent: "# Title\n\n## Section\n",
      claudeMdInstructionCount: 0,
    }));
    expect(result.score).toBe(30);
    expect(result.issues[0].severity).toBe("medium");
  });
});
