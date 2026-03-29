import { describe, it, expect } from "vitest";
import { analyzeHooks } from "../src/commands/doctor/analyzers/hooks.js";
import type { ClaudeConfig, HookConfig } from "../src/types/index.js";

function makeConfig(hooks: HookConfig[] = []): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: "# Test",
    claudeMdInstructionCount: 10,
    settingsPath: null,
    settings: null,
    hooks,
    rules: [],
    mcpServers: [],
    skills: [],
  };
}

describe("analyzeHooks", () => {
  it("scores 30 when no hooks configured", async () => {
    const result = await analyzeHooks(makeConfig());
    expect(result.score).toBe(30);
    expect(result.issues[0].severity).toBe("medium");
  });

  it("scores 100 with all hook types present", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PostToolUse", type: "command", matcher: "Write|Edit", command: "prettier --write $FILE" },
      { event: "PreToolUse", type: "command", matcher: "Read|Write", command: "check .env files" },
      { event: "PostCompact", type: "command", matcher: "", command: "cat TASKS.md" },
    ]));
    expect(result.score).toBe(100);
  });

  it("flags missing auto-format hook", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PreToolUse", type: "command", matcher: "Write", command: "block .env" },
    ]));
    expect(result.issues.some((i) => i.message.includes("auto-format"))).toBe(true);
  });

  it("flags missing .env protection", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PostToolUse", type: "command", matcher: "Write|Edit", command: "prettier --write" },
    ]));
    expect(result.issues.some((i) => i.message.includes(".env"))).toBe(true);
  });

  it("recognizes various formatter names", async () => {
    const formatters = ["prettier", "gofmt", "rustfmt", "rubocop", "pint"];
    for (const fmt of formatters) {
      const result = await analyzeHooks(makeConfig([
        { event: "PostToolUse", type: "command", matcher: "Write|Edit", command: `${fmt} $FILE` },
        { event: "PreToolUse", type: "command", matcher: "Write", command: ".env block" },
      ]));
      expect(result.issues.some((i) => i.message.includes("auto-format"))).toBe(false);
    }
  });
});
