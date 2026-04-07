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
    localClaudeMdContent: null,
    localSettings: null,
    hooks,
    rules: [],
    mcpServers: [],
    skills: [],
    claudeignorePath: null,
    claudeignoreContent: null,
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
      { event: "SessionStart", type: "command", matcher: "startup", command: "cat TASKS.md" },
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

  it("recommends SessionEnd as info severity", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PreToolUse", type: "command", command: ".env block" },
    ]));
    const sessionEnd = result.issues.find((i) => i.message.includes("SessionEnd"));
    expect(sessionEnd).toBeDefined();
    expect(sessionEnd!.severity).toBe("info");
  });

  it("recommends UserPromptSubmit as info severity", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PreToolUse", type: "command", command: ".env block" },
    ]));
    const ups = result.issues.find((i) => i.message.includes("UserPromptSubmit"));
    expect(ups).toBeDefined();
    expect(ups!.severity).toBe("info");
  });

  it("info issues do not reduce score", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PostToolUse", type: "command", matcher: "Write|Edit", command: "prettier --write $FILE" },
      { event: "PreToolUse", type: "command", matcher: "Read|Write", command: "check .env files" },
      { event: "PostCompact", type: "command", command: "cat TASKS.md" },
      { event: "SessionStart", type: "command", command: "cat TASKS.md" },
    ]));
    expect(result.score).toBe(100);
    const infoIssues = result.issues.filter((i) => i.severity === "info");
    expect(infoIssues.length).toBeGreaterThan(0);
  });

  it("notes hook type diversity when all are command type", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PreToolUse", type: "command", command: ".env" },
      { event: "PostToolUse", type: "command", command: "prettier" },
    ]));
    expect(result.issues.some((i) => i.message.includes("hook types"))).toBe(true);
  });

  it("does not flag hook type diversity when http type present", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PreToolUse", type: "command", command: ".env" },
      { event: "PostToolUse", type: "http", command: "https://hook.example.com" },
    ]));
    expect(result.issues.some((i) => i.message.includes("hook types"))).toBe(false);
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
