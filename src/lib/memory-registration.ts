import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Where the agentic-memory MCP server can be registered:
 * project scope (.mcp.json), local scope (.claude/settings.local.json),
 * or user scope (~/.claude.json — written by `claude mcp add --scope local`).
 * Shared between the memory command and doctor analyzers.
 */
export function isMemoryMcpRegistered(projectRoot: string): boolean {
  return hasMemoryServerInJson(join(projectRoot, ".mcp.json"), "mcpServers")
    || hasMemoryServerInJson(join(projectRoot, ".claude", "settings.local.json"), "mcpServers")
    || hasMemoryServerInUserConfig(projectRoot);
}

function hasMemoryServerInJson(path: string, key: string): boolean {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    const servers = parsed[key] as Record<string, unknown> | undefined;
    return !!servers && typeof servers === "object" && "agentic-memory" in servers;
  } catch {
    return false;
  }
}

function hasMemoryServerInUserConfig(projectRoot: string): boolean {
  try {
    const parsed = JSON.parse(readFileSync(join(homedir(), ".claude.json"), "utf-8")) as Record<string, unknown>;
    // User-scope registration lives under projects[projectRoot].mcpServers
    const projects = parsed.projects as Record<string, unknown> | undefined;
    const project = projects?.[projectRoot] as Record<string, unknown> | undefined;
    const scoped = project?.mcpServers as Record<string, unknown> | undefined;
    if (scoped && "agentic-memory" in scoped) return true;
    // Global user scope (~/.claude.json top-level mcpServers, if Claude Code ever uses it)
    const global = parsed.mcpServers as Record<string, unknown> | undefined;
    return !!global && "agentic-memory" in global;
  } catch {
    return false;
  }
}
