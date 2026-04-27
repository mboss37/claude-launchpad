import { describe, it, expect } from "vitest";
import { analyzeMcp } from "../src/commands/doctor/analyzers/mcp.js";
import type { ClaudeConfig } from "../src/types/index.js";

function makeConfig(overrides: Partial<ClaudeConfig> = {}): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: "# Test",
    claudeMdInstructionCount: 10,
    settingsPath: null,
    settings: null,
    localClaudeMdContent: null,
    localSettings: null,
    hooks: [],
    rules: [],
    mcpServers: [],
    skills: [],
    ...overrides,
  };
}

describe("analyzeMcp", () => {
  it("returns info when no MCP servers configured", async () => {
    const result = await analyzeMcp(makeConfig());
    expect(result.score).toBe(50);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe("info");
  });

  it("returns 100 for valid stdio server config with allowedMcpServers", async () => {
    const result = await analyzeMcp(makeConfig({
      settings: { allowedMcpServers: [{ serverName: "github" }] },
      mcpServers: [{
        name: "github",
        transport: "stdio",
        command: "npx @modelcontextprotocol/server-github",
      }],
    }));
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("flags missing allowedMcpServers when servers exist", async () => {
    const result = await analyzeMcp(makeConfig({
      mcpServers: [{
        name: "github",
        transport: "stdio",
        command: "npx @modelcontextprotocol/server-github",
      }],
    }));
    expect(result.issues.some((i) => i.message.includes("allowedMcpServers"))).toBe(true);
    expect(result.score).toBe(75);
  });

  it("flags stdio server without command", async () => {
    const result = await analyzeMcp(makeConfig({
      mcpServers: [{
        name: "broken",
        transport: "stdio",
      }],
    }));
    expect(result.issues.some((i) => i.severity === "high")).toBe(true);
  });

  it("flags HTTP server without URL", async () => {
    const result = await analyzeMcp(makeConfig({
      mcpServers: [{
        name: "broken",
        transport: "http",
      }],
    }));
    expect(result.issues.some((i) => i.severity === "high")).toBe(true);
  });

  it("flags orphaned mcp__<server>__* permission entries when server is not registered", async () => {
    const result = await analyzeMcp(makeConfig({
      settings: {
        allowedMcpServers: [{ serverName: "github" }],
        permissions: {
          allow: ["mcp__stale-server__some_tool", "mcp__github__create_issue"],
        },
      },
      mcpServers: [{
        name: "github",
        transport: "stdio",
        command: "npx @modelcontextprotocol/server-github",
      }],
    }));
    const orphan = result.issues.find((i) => i.message.includes("stale-server"));
    expect(orphan).toBeDefined();
    expect(orphan?.severity).toBe("medium");
    expect(orphan?.message).toContain("stale entries silently block tool calls");
  });

  it("does not flag mcp__<server>__* entries when server is registered", async () => {
    const result = await analyzeMcp(makeConfig({
      settings: {
        allowedMcpServers: [{ serverName: "github" }],
        permissions: {
          allow: ["mcp__github__create_issue", "mcp__github__list_repos"],
        },
      },
      mcpServers: [{
        name: "github",
        transport: "stdio",
        command: "npx @modelcontextprotocol/server-github",
      }],
    }));
    expect(result.issues.some((i) => i.message.includes("stale entries"))).toBe(false);
  });

  it("dedupes multiple orphan entries for the same server into one finding", async () => {
    const result = await analyzeMcp(makeConfig({
      settings: {
        allowedMcpServers: [{ serverName: "github" }],
        permissions: {
          allow: ["mcp__ghost__a", "mcp__ghost__b", "mcp__ghost__c"],
        },
      },
      mcpServers: [{
        name: "github",
        transport: "stdio",
        command: "npx @modelcontextprotocol/server-github",
      }],
    }));
    const orphanFindings = result.issues.filter((i) => i.message.includes("ghost"));
    expect(orphanFindings).toHaveLength(1);
  });

  it("detects orphans across both shared and local settings", async () => {
    const result = await analyzeMcp(makeConfig({
      settings: {
        allowedMcpServers: [{ serverName: "github" }],
        permissions: { allow: ["mcp__shared-orphan__x"] },
      },
      localSettings: {
        permissions: { allow: ["mcp__local-orphan__y"] },
      },
      mcpServers: [{
        name: "github",
        transport: "stdio",
        command: "npx @modelcontextprotocol/server-github",
      }],
    }));
    expect(result.issues.some((i) => i.message.includes("shared-orphan"))).toBe(true);
    expect(result.issues.some((i) => i.message.includes("local-orphan"))).toBe(true);
  });
});
