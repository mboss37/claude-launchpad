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
    claudeignorePath: null,
    claudeignoreContent: null,
  };
}

describe("analyzeSettings", () => {
  it("scores 40 when no settings.json exists", async () => {
    const result = await analyzeSettings(makeConfig(null));
    expect(result.score).toBe(40);
    expect(result.issues[0].severity).toBe("medium");
  });

  it("scores 100 when settings has hooks", async () => {
    const result = await analyzeSettings(makeConfig({
      hooks: { PreToolUse: [{ matcher: "Write", hooks: [] }] },
    }));
    expect(result.score).toBe(100);
  });

  it("flags missing hooks as medium", async () => {
    const result = await analyzeSettings(makeConfig({}));
    expect(result.issues.some((i) => i.severity === "medium" && i.message.includes("hooks"))).toBe(true);
  });

  it("plugins missing is info severity (does not affect score)", async () => {
    const result = await analyzeSettings(makeConfig({
      hooks: { PreToolUse: [{}] },
    }));
    const pluginIssue = result.issues.find((i) => i.message.includes("plugin"));
    expect(pluginIssue?.severity).toBe("info");
  });

  it("flags allowedTools without parsed hooks as dangerous", async () => {
    // config.hooks is the parsed array — empty means no hooks detected
    const config = makeConfig({ allowedTools: ["Bash", "Write"] });
    const result = await analyzeSettings(config);
    expect(result.issues.some((i) => i.message.includes("safety net"))).toBe(true);
  });

  it("does not flag allowedTools when parsed hooks exist", async () => {
    const config: ClaudeConfig = {
      ...makeConfig({ allowedTools: ["Bash"], hooks: { PreToolUse: [{}] } }),
      hooks: [{ event: "PreToolUse", type: "command", matcher: "Bash", command: "echo ok" }],
    };
    const result = await analyzeSettings(config);
    expect(result.issues.some((i) => i.message.includes("safety net"))).toBe(false);
  });

  it("flags deprecated includeCoAuthoredBy", async () => {
    const result = await analyzeSettings(makeConfig({
      hooks: { PreToolUse: [{}] },
      includeCoAuthoredBy: false,
    }));
    expect(result.issues.some((i) => i.message.includes("Deprecated includeCoAuthoredBy"))).toBe(true);
  });

  it("does not flag when includeCoAuthoredBy is absent", async () => {
    const result = await analyzeSettings(makeConfig({
      hooks: { PreToolUse: [{}] },
    }));
    expect(result.issues.some((i) => i.message.includes("Deprecated"))).toBe(false);
  });

  it("flags hooks without timeout on broad matchers", async () => {
    const config: ClaudeConfig = {
      ...makeConfig({ hooks: { PreToolUse: [{}] } }),
      hooks: [{ event: "PreToolUse", type: "command", matcher: "Bash", command: "echo ok" }],
    };
    const result = await analyzeSettings(config);
    expect(result.issues.some((i) => i.message.includes("without timeout"))).toBe(true);
  });

  it("does not flag hooks with timeout set", async () => {
    const config: ClaudeConfig = {
      ...makeConfig({ hooks: { PreToolUse: [{}] } }),
      hooks: [{ event: "PreToolUse", type: "command", matcher: "Bash", command: "echo ok", timeout: 10 }],
    };
    const result = await analyzeSettings(config);
    expect(result.issues.some((i) => i.message.includes("without timeout"))).toBe(false);
  });

  it("flags auto-memory disabled without memory section", async () => {
    const result = await analyzeSettings(makeConfig({
      hooks: { PreToolUse: [{}] },
      autoMemoryEnabled: false,
    }));
    expect(result.issues.some((i) => i.message.includes("Auto-memory is disabled"))).toBe(true);
  });

  it("does not flag auto-memory disabled when CLAUDE.md has Memory section", async () => {
    const config: ClaudeConfig = {
      ...makeConfig({ hooks: { PreToolUse: [{}] }, autoMemoryEnabled: false }),
      claudeMdContent: "# Test\n## Memory & Learnings\n- Save gotchas",
    };
    const result = await analyzeSettings(config);
    expect(result.issues.some((i) => i.message.includes("Auto-memory"))).toBe(false);
  });
});
