import { describe, it, expect } from "vitest";
import { analyzeSettings } from "../src/commands/doctor/analyzers/settings.js";
import type { ClaudeConfig } from "../src/types/index.js";

function makeConfig(settings: Record<string, unknown> | null = null): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: "# Test",
    claudeMdInstructionCount: 10,
    settingsPath: settings ? "/test/.claude/settings.json" : null,
    settings,
    hooks: [],
    rules: [],
    mcpServers: [],
    skills: [],
  };
}

describe("analyzeSettings", () => {
  it("scores 40 when no settings.json exists", async () => {
    const result = await analyzeSettings(makeConfig(null));
    expect(result.score).toBe(40);
    expect(result.issues[0].severity).toBe("medium");
  });

  it("scores 100 with plugins, permissions, and env", async () => {
    const result = await analyzeSettings(makeConfig({
      enabledPlugins: { "some-plugin": true },
      permissions: { allow: ["Bash"] },
      env: { NODE_ENV: "development" },
    }));
    expect(result.score).toBe(100);
  });

  it("flags missing plugins", async () => {
    const result = await analyzeSettings(makeConfig({}));
    expect(result.issues.some((i) => i.message.includes("plugin"))).toBe(true);
  });

  it("flags missing permissions", async () => {
    const result = await analyzeSettings(makeConfig({ enabledPlugins: { x: true } }));
    expect(result.issues.some((i) => i.message.includes("permission"))).toBe(true);
  });
});
