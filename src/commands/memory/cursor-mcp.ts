import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { mergeCursorMcp } from "../../harness/cursor/merge.js";

const MEMORY_SERVER = {
  command: "npx",
  args: ["claude-launchpad", "memory", "serve"],
} as const;

const UNREADABLE_MCP =
  ".cursor/mcp.json is unreadable; repair or remove it before installing memory.";

export function registerCursorMemoryMcp(projectRoot: string): boolean {
  const path = join(projectRoot, ".cursor", "mcp.json");
  const existing = readExistingMcp(path);
  if (hasAgenticMemory(existing)) return false;
  const merged = mergeCursorMcp(existing, {
    mcpServers: { "agentic-memory": MEMORY_SERVER },
  });
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`);
  return true;
}

function readExistingMcp(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    if (isObjectMap(parsed)) {
      if ("mcpServers" in parsed && !isObjectMap(parsed.mcpServers)) {
        throw new Error(UNREADABLE_MCP);
      }
      return parsed;
    }
  } catch (err) {
    if (err instanceof Error && err.message === UNREADABLE_MCP) throw err;
  }
  throw new Error(UNREADABLE_MCP);
}

function isObjectMap(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasAgenticMemory(value: Record<string, unknown>): boolean {
  const servers = value.mcpServers;
  return (
    servers !== null &&
    typeof servers === "object" &&
    !Array.isArray(servers) &&
    "agentic-memory" in servers
  );
}
