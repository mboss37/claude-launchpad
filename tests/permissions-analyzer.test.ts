import { describe, it, expect } from "vitest";
import { analyzePermissions } from "../src/commands/doctor/analyzers/permissions.js";
import type { ClaudeConfig } from "../src/types/index.js";

function makeConfig(overrides: Partial<ClaudeConfig> = {}): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: "# Test\n## Off-Limits\n- Never hardcode secrets",
    claudeMdInstructionCount: 10,
    settingsPath: null,
    settings: null,
    hooks: [],
    rules: [],
    mcpServers: [],
    skills: [],
    ...overrides,
  };
}

describe("analyzePermissions", () => {
  it("flags missing Off-Limits section", async () => {
    const result = await analyzePermissions(makeConfig({
      claudeMdContent: "# Test\nNo off-limits here",
    }));
    expect(result.issues.some((i) => i.message.includes("Off-Limits"))).toBe(true);
  });

  it("does not flag when Off-Limits section exists", async () => {
    const result = await analyzePermissions(makeConfig());
    expect(result.issues.some((i) => i.message.includes("Off-Limits"))).toBe(false);
  });

  it("flags missing force-push protection", async () => {
    const result = await analyzePermissions(makeConfig());
    expect(result.issues.some((i) => i.message.includes("force-push"))).toBe(true);
  });

  it("does not flag force-push when hook exists", async () => {
    const result = await analyzePermissions(makeConfig({
      hooks: [{ event: "PreToolUse", type: "command", matcher: "Bash", command: "check force push" }],
    }));
    expect(result.issues.some((i) => i.message.includes("force-push"))).toBe(false);
  });

  it("flags auto-allowed Bash without security hook", async () => {
    const result = await analyzePermissions(makeConfig({
      settings: { allowedTools: ["Bash"] },
    }));
    expect(result.issues.some((i) => i.message.includes("Bash"))).toBe(true);
  });
});
