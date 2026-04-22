import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyzeMemory } from "../src/commands/doctor/analyzers/memory.js";
import type { ClaudeConfig, HookConfig, McpServerConfig } from "../src/types/index.js";

const mockReadSyncConfig = vi.fn(() => null);
vi.mock("../src/commands/memory/utils/gist-transport.js", () => ({
  readSyncConfig: (...args: unknown[]) => mockReadSyncConfig(...args),
}));

function makeConfig(overrides: {
  settings?: Record<string, unknown> | null;
  localSettings?: Record<string, unknown> | null;
  hooks?: ReadonlyArray<HookConfig>;
  mcpServers?: ReadonlyArray<McpServerConfig>;
  claudeMdContent?: string | null;
  localClaudeMdContent?: string | null;
} = {}): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: overrides.claudeMdContent ?? "# Test",
    claudeMdInstructionCount: 10,
    settingsPath: "/test/.claude/settings.json",
    settings: overrides.settings ?? {},
    localClaudeMdContent: overrides.localClaudeMdContent ?? null,
    localSettings: overrides.localSettings ?? null,
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
    const result = await analyzeMemory(makeConfig(), "/test");
    expect(result).toBeNull();
  });

  it("returns null when hooks have no memory references", async () => {
    const result = await analyzeMemory(makeConfig({
      hooks: [{ event: "SessionStart", type: "command", command: "cat TASKS.md" }],
    }), "/test");
    expect(result).toBeNull();
  });

  it("detects memory via MCP server", async () => {
    const result = await analyzeMemory(makeConfig({ mcpServers: [memoryServer] }), "/test");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Memory");
  });

  it("detects memory via SessionStart hook even without MCP server entry", async () => {
    const result = await analyzeMemory(makeConfig({ hooks: [sessionStartHook] }), "/test");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Memory");
  });

  it("detects memory via tool permissions even without MCP server entry", async () => {
    const result = await analyzeMemory(makeConfig({
      settings: { permissions: { allow: ["mcp__agentic-memory__memory_store"] } },
    }), "/test");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Memory");
  });

  it("flags missing SessionStart hook as high severity", async () => {
    const result = await analyzeMemory(makeConfig({ mcpServers: [memoryServer] }), "/test");
    expect(result!.issues.some(
      (i) => i.severity === "high" && i.message.includes("SessionStart"),
    )).toBe(true);
  });

  it("flags autoMemoryEnabled not disabled as medium severity", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      settings: {},
    }), "/test");
    expect(result!.issues.some(
      (i) => i.severity === "medium" && i.message.includes("autoMemoryEnabled"),
    )).toBe(true);
  });

  it("does not flag autoMemoryEnabled when set to false", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      settings: { autoMemoryEnabled: false },
    }), "/test");
    expect(result!.issues.some(
      (i) => i.message.includes("autoMemoryEnabled"),
    )).toBe(false);
  });

  it("flags missing CLAUDE.md memory guidance as low severity", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      claudeMdContent: "# Test project",
    }), "/test");
    expect(result!.issues.some(
      (i) => i.severity === "low" && i.message.includes("memory guidance"),
    )).toBe(true);
  });

  it("does not flag when CLAUDE.md contains ## Memory", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      claudeMdContent: "# Test\n## Memory\nUse agentic-memory",
    }), "/test");
    expect(result!.issues.some(
      (i) => i.message.includes("memory guidance"),
    )).toBe(false);
  });

  it("does not flag when CLAUDE.md mentions agentic-memory", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      claudeMdContent: "# Test\nUse agentic-memory for persistence",
    }), "/test");
    expect(result!.issues.some(
      (i) => i.message.includes("memory guidance"),
    )).toBe(false);
  });

  it("flags missing MCP tool permissions as low severity", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      settings: { permissions: { allow: [] } },
    }), "/test");
    expect(result!.issues.some(
      (i) => i.severity === "low" && i.message.includes("tool permission"),
    )).toBe(true);
  });

  it("does not flag when all MCP tools are in allowedTools", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      settings: { permissions: { allow: ALL_TOOLS } },
    }), "/test");
    expect(result!.issues.some(
      (i) => i.message.includes("tool permission"),
    )).toBe(false);
  });

  it("returns perfect score when fully configured", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [sessionStartHook],
      settings: { autoMemoryEnabled: false, permissions: { allow: ALL_TOOLS } },
      claudeMdContent: "# Test\n## Memory\nUse agentic-memory",
    }), "/test");
    expect(result!.score).toBe(100);
    expect(result!.issues).toHaveLength(0);
  });

  // ─── Local config detection ───

  it("does not flag autoMemoryEnabled when set in local settings", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      settings: {},
      localSettings: { autoMemoryEnabled: false },
    }), "/test");
    expect(result!.issues.some(
      (i) => i.message.includes("autoMemoryEnabled"),
    )).toBe(false);
  });

  it("does not flag memory guidance when in local CLAUDE.md", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      claudeMdContent: "# Test project",
      localClaudeMdContent: "## Memory\nUse agentic-memory",
    }), "/test");
    expect(result!.issues.some(
      (i) => i.message.includes("memory guidance"),
    )).toBe(false);
  });

  it("does not flag tool permissions when in local settings", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      settings: { permissions: { allow: [] } },
      localSettings: { permissions: { allow: ALL_TOOLS } },
    }), "/test");
    expect(result!.issues.some(
      (i) => i.message.includes("tool permission"),
    )).toBe(false);
  });

  it("merges tool permissions from both settings files", async () => {
    const half1 = ALL_TOOLS.slice(0, 4);
    const half2 = ALL_TOOLS.slice(4);
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      settings: { permissions: { allow: half1 } },
      localSettings: { permissions: { allow: half2 } },
    }), "/test");
    expect(result!.issues.some(
      (i) => i.message.includes("tool permission"),
    )).toBe(false);
  });

  it("calculates score correctly with mixed severities", async () => {
    // Only MCP server, nothing else → high (SessionStart) + medium (autoMemory) + low (guidance) + low (tools)
    const result = await analyzeMemory(makeConfig({ mcpServers: [memoryServer] }), "/test");
    // 100 - (20 + 10 + 5 + 5) = 60
    expect(result!.score).toBe(60);
  });

  // ─── SessionEnd sync hook ───

  it("does not flag SessionEnd push hook when sync is not configured", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [sessionStartHook],
    }), "/test");
    expect(result!.issues.some((i) => i.message.includes("SessionEnd"))).toBe(false);
  });

  it("flags missing SessionEnd push hook when sync is configured", async () => {
    mockReadSyncConfig.mockReturnValueOnce({ gistId: "abc123" });

    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [sessionStartHook],
    }), "/test");
    expect(result!.issues.some((i) => i.message.includes("SessionEnd"))).toBe(true);
  });

  it("does not flag when SessionEnd push hook is nohup-wrapped and sync is configured", async () => {
    mockReadSyncConfig.mockReturnValueOnce({ gistId: "abc123" });

    const sessionEndPush: HookConfig = {
      event: "SessionEnd",
      type: "command",
      command: "nohup claude-launchpad memory push -y </dev/null >/dev/null 2>&1 & exit 0",
    };
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [sessionStartHook, sessionEndPush],
    }), "/test");
    expect(result!.issues.some((i) => i.message.includes("SessionEnd"))).toBe(false);
  });

  it("flags SessionEnd push hook that is not nohup-wrapped", async () => {
    mockReadSyncConfig.mockReturnValueOnce({ gistId: "abc123" });

    const sessionEndPush: HookConfig = {
      event: "SessionEnd",
      type: "command",
      command: "claude-launchpad memory push -y >/dev/null 2>&1; exit 0",
    };
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [sessionStartHook, sessionEndPush],
    }), "/test");
    expect(result!.issues.some((i) => i.message.includes("not nohup-wrapped"))).toBe(true);
  });

  // ─── SessionStart pull hook ───

  it("does not flag SessionStart pull hook when sync is not configured", async () => {
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [sessionStartHook],
    }), "/test");
    expect(result!.issues.some((i) => i.message.includes("auto-pull"))).toBe(false);
  });

  it("flags missing SessionStart pull hook when sync is configured", async () => {
    mockReadSyncConfig.mockReturnValueOnce({ gistId: "abc123" });

    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [sessionStartHook],
    }), "/test");
    expect(result!.issues.some(
      (i) => i.severity === "medium" && i.message.includes("auto-pull"),
    )).toBe(true);
  });

  it("does not flag when SessionStart pull hook exists and sync is configured", async () => {
    mockReadSyncConfig.mockReturnValueOnce({ gistId: "abc123" });

    const sessionStartPull: HookConfig = {
      event: "SessionStart",
      type: "command",
      command: "claude-launchpad memory pull -y",
    };
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [sessionStartHook, sessionStartPull],
    }), "/test");
    expect(result!.issues.some((i) => i.message.includes("auto-pull"))).toBe(false);
  });
});

describe("analyzeMemory — wrapper-aware hook resolution", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "lp-memory-wrapper-"));
    await mkdir(join(root, ".claude"), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("recognises memory context in a wrapper .sh file (swissazan scenario)", async () => {
    await writeFile(
      join(root, ".claude", "session-start.sh"),
      "#!/bin/bash\ncat TASKS.md\nclaude-launchpad memory context --json\n",
    );
    const wrappedHook: HookConfig = {
      event: "SessionStart",
      type: "command",
      command: "bash .claude/session-start.sh 2>/dev/null; exit 0",
    };
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [wrappedHook],
    }), root);
    expect(result).not.toBeNull();
    expect(result!.issues.some(
      (i) => i.message.includes("No SessionStart hook with memory context"),
    )).toBe(false);
  });

  it("still flags when the wrapper script exists but does not inject memory context", async () => {
    await writeFile(
      join(root, ".claude", "session-start.sh"),
      "#!/bin/bash\ncat TASKS.md\n",
    );
    const wrappedHook: HookConfig = {
      event: "SessionStart",
      type: "command",
      command: "bash .claude/session-start.sh",
    };
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [wrappedHook],
    }), root);
    expect(result!.issues.some(
      (i) => i.severity === "high" && i.message.includes("memory context"),
    )).toBe(true);
  });

  it("flags a broken wrapper (hook points at a missing .sh file)", async () => {
    const wrappedHook: HookConfig = {
      event: "SessionStart",
      type: "command",
      command: "bash .claude/does-not-exist.sh",
    };
    const result = await analyzeMemory(makeConfig({
      mcpServers: [memoryServer],
      hooks: [wrappedHook],
    }), root);
    expect(result!.issues.some(
      (i) => i.severity === "low" && i.message.includes("file is missing"),
    )).toBe(true);
  });
});
