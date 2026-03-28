import { access } from "node:fs/promises";
import { detectProject } from "../../../lib/detect.js";
import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";

export async function analyzeMcp(config: ClaudeConfig): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];
  const servers = config.mcpServers;

  if (servers.length === 0) {
    // Detect stack and recommend relevant MCP servers
    const detected = await detectProject(process.cwd());
    const recommendations = getRecommendations(detected.language, detected.framework);

    if (recommendations.length > 0) {
      issues.push({
        analyzer: "MCP",
        severity: "info",
        message: `No MCP servers configured. Recommended for your stack: ${recommendations.join(", ")}`,
        fix: `Run: ${recommendations.map((r) => `claude mcp add ${r}`).join(" && ")}`,
      });
    } else {
      issues.push({
        analyzer: "MCP",
        severity: "info",
        message: "No MCP servers configured",
        fix: "Add MCP servers for GitHub, database, docs, etc.",
      });
    }
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

  const score = Math.max(0, 100 - issues.filter((i) => i.severity !== "info").length * 25);
  return { name: "MCP Servers", issues, score };
}

function getRecommendations(language: string | null, framework: string | null): string[] {
  const recs: string[] = [];

  // Database MCP servers based on framework
  if (framework === "Next.js" || framework === "NestJS" || framework === "Express" || framework === "Fastify" || framework === "Hono") {
    recs.push("context7");
  }
  if (framework === "FastAPI" || framework === "Django" || framework === "Flask") {
    recs.push("context7");
  }
  if (framework === "Rails") {
    recs.push("context7");
  }
  if (framework === "Laravel" || framework === "Symfony") {
    recs.push("context7");
  }

  // Context7 for all recognized languages (docs lookup)
  if (language && recs.length === 0) {
    recs.push("context7");
  }

  return [...new Set(recs)]; // Deduplicate
}
