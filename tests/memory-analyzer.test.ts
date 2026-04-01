import { describe, it, expect } from "vitest";
import { analyzeMemory } from "../src/commands/doctor/analyzers/memory.js";
import type { ClaudeConfig, HookConfig, McpServerConfig } from "../src/types/index.js";

function makeConfig(overrides: {
  settings?: Record<string, unknown> | null;
  hooks?: ReadonlyArray<HookConfig>;
  mcpServers?: ReadonlyArray<McpServerConfig>;
  claudeMdContent?: string | null;
} = {}): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: overrides.claudeMdContent ?? "# Test",
    claudeMdInstructionCount: 10,
    settingsPath: "/test/.claude/settings.json",
    settings: overrides.settings ?? {},
    hooks: overrides.hooks ?? [],
    rules: [],
    mcpServers: overrides.mcpServers ?? [],
    skills: [],
    claudeignorePath: null,
    claudeignoreContent: null,
  };
}

const memoryServer: McpServerConfig = {
  name: "agentic-memory",
  transport: "stdio",
  command: "npx agentic-memory",
};

const sessionStartHook: HookConfig = {
  event: "SessionStart",
  type: "command",
  command: "memory context --project test",
};

const stopHook: HookConfig = {
  event: "Stop",
  type: "command",
  command: "memory extract --project test",
};

const ALL_TOOLS = [
  "mcp__agentic-memory__memory_store",
  "mcp__agentic-memory__memory_search",
  "mcp__agentic-memory__memory_recent",
  "mcp__agentic-memory__memory_forget",
  "mcp__agentic-memory__memory_relate",
  "mcp__agentic-memory__memory_stats",
  "mcp__agentic-memory__memory_update",
];

describe("analyzeMemory", () => {
  it("returns null when no memory indicators in config", async () => {
    const result = await analyzeMemory(makeConfig());
    expect(result).toBeNull();
  });

  it("returns null when hooks have no memory references", async () => {
    const result = await analyzeMemory(makeConfig({
      hooks: [{ event: "SessionStart", type: "command", command: "cat TASKS.md" }],
    }));
    expect(result).toBeNull();
  });

  it("detects memory via MCP server", async () => {
    const result = await analyzeMemory(makeConfig({ mcpServers: [memoryServer] }));
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Memory");
  });

  it("detects memory via hook command", async () => {
    const result = await analyzeMemory(makeConfig({ hooks: [sessionStartHook] }));
    expect(result).not.toBeNull();
  });

  it("flags missing MCP server as high severity", async () => {
    const result = await analyzeMemory(makeConfig({ hooks: [sessionStartHook, stopHook] }));
    expect(result!.issues.some(
      (i) => i.severity === "high" && i.message.includes("MCP server not found"),
    )).toBe(true);
  });

  it("flags missing SessionStart hook as high severity", async () => {
    const result = await analyzeMemory(makeConfig({ mcpServers: [memoryServer] }));
    expect(result!.issues.some(
      (i) => i.severity === "high" && i.message.includes("SessionStart"),
    )).toBe(true);
  });

  it("flags missing Stop hook as medium severity", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [sessionStartHook],
    }));
    expect(result!.issues.some(
      (i) => i.severity === "medium" && i.message.includes("Stop hook"),
    )).toBe(true);
  });

  it("flags autoMemoryEnabled not disabled as medium severity", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      settings: {},
    }));
    expect(result!.issues.some(
      (i) => i.severity === "medium" && i.message.includes("autoMemoryEnabled"),
    )).toBe(true);
  });

  it("does not flag autoMemoryEnabled when set to false", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      settings: { autoMemoryEnabled: false },
    }));
    expect(result!.issues.some(
      (i) => i.message.includes("autoMemoryEnabled"),
    )).toBe(false);
  });

  it("flags missing CLAUDE.md memory guidance as low severity", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      claudeMdContent: "# Test project",
    }));
    expect(result!.issues.some(
      (i) => i.severity === "low" && i.message.includes("memory guidance"),
    )).toBe(true);
  });

  it("does not flag when CLAUDE.md contains ## Memory", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      claudeMdContent: "# Test\n## Memory\nUse agentic-memory",
    }));
    expect(result!.issues.some(
      (i) => i.message.includes("memory guidance"),
    )).toBe(false);
  });

  it("does not flag when CLAUDE.md mentions agentic-memory", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      claudeMdContent: "# Test\nUse agentic-memory for persistence",
    }));
    expect(result!.issues.some(
      (i) => i.message.includes("memory guidance"),
    )).toBe(false);
  });

  it("flags missing MCP tool permissions as low severity", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      settings: { allowedTools: [] },
    }));
    expect(result!.issues.some(
      (i) => i.severity === "low" && i.message.includes("tool permission"),
    )).toBe(true);
  });

  it("does not flag when all MCP tools are in allowedTools", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      settings: { allowedTools: ALL_TOOLS },
    }));
    expect(result!.issues.some(
      (i) => i.message.includes("tool permission"),
    )).toBe(false);
  });

  it("returns perfect score when fully configured", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [sessionStartHook, stopHook],
      settings: { autoMemoryEnabled: false, allowedTools: ALL_TOOLS },
      claudeMdContent: "# Test\n## Memory\nUse agentic-memory",
    }));
    expect(result!.score).toBe(100);
    expect(result!.issues).toHaveLength(0);
  });

  it("calculates score correctly with mixed severities", async () => {
    // Only MCP server, nothing else → high (SessionStart) + medium (Stop) + medium (autoMemory) + low (guidance) + low (tools)
    const result = await analyzeMemory(makeConfig({ mcpServers: [memoryServer] }));
    // 100 - (20 + 10 + 10 + 5 + 5) = 50
    expect(result!.score).toBe(50);
  });
});
