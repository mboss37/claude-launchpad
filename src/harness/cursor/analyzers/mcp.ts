import type { AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";
import type { CursorConfig } from "../types.js";
import { scoreIssues } from "./score.js";

export async function analyzeCursorMcp(
  config: CursorConfig,
): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = config.parseErrors
    .filter((error) => error.path.endsWith("mcp.json"))
    .map((error) => ({
      analyzer: "MCP",
      severity: "high" as const,
      message: `Malformed ${error.path}: ${error.message}`,
      fix: "Fix the JSON syntax; doctor will not overwrite it",
    }));

  for (const server of config.mcpServers) {
    if (server.transport === "stdio" && !server.command) {
      issues.push({
        analyzer: "MCP",
        severity: "high",
        message: `MCP server "${server.name}" uses stdio transport but has no command`,
        fix: `Add a "command" field to the "${server.name}" MCP server config`,
      });
    }
    if (
      (server.transport === "sse" || server.transport === "http") &&
      !server.url
    ) {
      issues.push({
        analyzer: "MCP",
        severity: "high",
        message: `MCP server "${server.name}" uses ${server.transport} transport but has no URL`,
        fix: `Add a "url" field to the "${server.name}" MCP server config`,
      });
    }
  }

  return { name: "MCP", issues, score: scoreIssues(issues) };
}
