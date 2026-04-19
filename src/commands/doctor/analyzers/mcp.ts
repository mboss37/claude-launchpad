import { access } from "node:fs/promises";
import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";

export async function analyzeMcp(config: ClaudeConfig): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];
  const servers = config.mcpServers;

  if (servers.length === 0) {
    issues.push({
      analyzer: "MCP",
      severity: "info",
      message: "No MCP servers configured. Use `/lp-enhance` in Claude Code to get stack-specific recommendations.",
    });
    return { name: "MCP Servers", issues, score: 50 };
  }

  for (const server of servers) {
    if (server.transport === "stdio" && !server.command) {
      issues.push({
        analyzer: "MCP",
        severity: "high",
        message: `MCP server "${server.name}" uses stdio transport but has no command`,
        fix: `Add a "command" field to the "${server.name}" MCP server config`,
      });
    }

    if ((server.transport === "sse" || server.transport === "http") && !server.url) {
      issues.push({
        analyzer: "MCP",
        severity: "high",
        message: `MCP server "${server.name}" uses ${server.transport} transport but has no URL`,
        fix: `Add a "url" field to the "${server.name}" MCP server config`,
      });
    }

    if (server.transport === "stdio" && server.command) {
      const executable = server.command.split(" ")[0];
      if (executable.startsWith("/") || executable.startsWith("./")) {
        try {
          await access(executable);
        } catch {
          issues.push({
            analyzer: "MCP",
            severity: "medium",
            message: `MCP server "${server.name}" command not found: ${executable}`,
            fix: "Verify the path exists or install the required package",
          });
        }
      }
    }
  }

  // Check for allowedMcpServers when servers are configured
  if (servers.length > 0) {
    const settings = config.settings ?? {};
    const localSettings = config.localSettings ?? {};
    const hasAllowList = settings.allowedMcpServers || localSettings.allowedMcpServers;
    if (!hasAllowList) {
      issues.push({
        analyzer: "MCP",
        severity: "medium",
        message: "MCP servers configured but no allowedMcpServers list — any added server is auto-trusted",
        fix: "Add allowedMcpServers to settings.json listing only trusted server names",
      });
    }
  }

  const score = Math.max(0, 100 - issues.filter((i) => i.severity !== "info").length * 25);
  return { name: "MCP Servers", issues, score };
}
