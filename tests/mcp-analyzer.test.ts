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
});
