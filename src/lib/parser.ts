import { readdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readFileOrNull } from "./fs-utils.js";
import type { ClaudeConfig, HookConfig, McpServerConfig } from "../types/index.js";

const CLAUDE_MD = "CLAUDE.md";
const CLAUDE_DIR = ".claude";
const SETTINGS_FILE = "settings.json";
const RULES_DIR = "rules";

export async function parseClaudeConfig(projectRoot: string): Promise<ClaudeConfig> {
  const root = resolve(projectRoot);
  const claudeDir = join(root, CLAUDE_DIR);

  const [claudeMd, settings, hooks, rules, mcpServers, skills] = await Promise.all([
    readClaudeMd(root),
    readSettings(claudeDir),
    readHooks(claudeDir),
    readRules(claudeDir),
    readMcpServers(claudeDir),
    readSkills(claudeDir),
  ]);

  const instructionCount = claudeMd
    ? countInstructions(claudeMd)
    : 0;

  return {
    claudeMdPath: claudeMd !== null ? join(root, CLAUDE_MD) : null,
    claudeMdContent: claudeMd,
    claudeMdInstructionCount: instructionCount,
    settingsPath: settings !== null ? join(claudeDir, SETTINGS_FILE) : null,
    settings,
    hooks,
    rules,
    mcpServers,
    skills,
  };
}

// ─── CLAUDE.md ───

async function readClaudeMd(root: string): Promise<string | null> {
  return readFileOrNull(join(root, CLAUDE_MD));
}

/**
 * Count actionable instructions in CLAUDE.md.
 * Heuristic: non-empty, non-comment, non-heading-only lines that contain
 * imperative/declarative content (not blank lines or markdown structure).
 */
export function countInstructions(content: string): number {
  const lines = content.split("\n");
  let count = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines
    if (trimmed === "") continue;
    // Skip pure comments
    if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) continue;
    // Skip code fence markers
    if (trimmed.startsWith("```")) continue;
    // Skip headings that are just section markers (no instruction content)
    if (/^#{1,6}\s+\S/.test(trimmed)) continue;
    // Everything else is an instruction
    count++;
  }

  return count;
}

// ─── Settings ───

async function readSettings(claudeDir: string): Promise<Record<string, unknown> | null> {
  const raw = await readFileOrNull(join(claudeDir, SETTINGS_FILE));
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─── Hooks ───

async function readHooks(claudeDir: string): Promise<ReadonlyArray<HookConfig>> {
  const settingsRaw = await readFileOrNull(join(claudeDir, SETTINGS_FILE));
  if (settingsRaw === null) return [];

  try {
    const settings = JSON.parse(settingsRaw) as Record<string, unknown>;
    const hooks = settings.hooks as Record<string, unknown[]> | undefined;
    if (!hooks || typeof hooks !== "object") return [];

    const result: HookConfig[] = [];
    for (const [event, hookList] of Object.entries(hooks)) {
      if (!Array.isArray(hookList)) continue;
      for (const group of hookList) {
        const g = group as Record<string, unknown>;
        const matcher = g.matcher as string | undefined;

        // New schema: { matcher, hooks: [{ type, command }] }
        const nestedHooks = g.hooks as Record<string, unknown>[] | undefined;
        if (Array.isArray(nestedHooks)) {
          for (const hook of nestedHooks) {
            const h = hook as Record<string, unknown>;
            result.push({
              event: event as HookConfig["event"],
              type: (h.type as HookConfig["type"]) ?? "command",
              matcher,
              command: h.command as string | undefined,
            });
          }
        } else {
          // Legacy flat schema: { matcher, type, command }
          result.push({
            event: event as HookConfig["event"],
            type: (g.type as HookConfig["type"]) ?? "command",
            matcher,
            command: g.command as string | undefined,
          });
        }
      }
    }
    return result;
  } catch {
    return [];
  }
}

// ─── Rules ───

async function readRules(claudeDir: string): Promise<ReadonlyArray<string>> {
  const rulesDir = join(claudeDir, RULES_DIR);
  return listFilesRecursive(rulesDir, ".md");
}

// ─── MCP Servers ───

async function readMcpServers(claudeDir: string): Promise<ReadonlyArray<McpServerConfig>> {
  const settingsRaw = await readFileOrNull(join(claudeDir, SETTINGS_FILE));
  if (settingsRaw === null) return [];

  try {
    const settings = JSON.parse(settingsRaw) as Record<string, unknown>;
    const servers = settings.mcpServers as Record<string, unknown> | undefined;
    if (!servers || typeof servers !== "object") return [];

    const result: McpServerConfig[] = [];
    for (const [name, config] of Object.entries(servers)) {
      const c = config as Record<string, unknown>;
      result.push({
        name,
        transport: (c.transport as McpServerConfig["transport"]) ?? "stdio",
        command: c.command as string | undefined,
        url: c.url as string | undefined,
      });
    }
    return result;
  } catch {
    return [];
  }
}

// ─── Skills ───

async function readSkills(claudeDir: string): Promise<ReadonlyArray<string>> {
  const commandsDir = join(claudeDir, "commands");
  const skillsDir = join(claudeDir, "skills");

  const [commands, skills] = await Promise.all([
    listFilesRecursive(commandsDir, ".md"),
    listFilesRecursive(skillsDir, ".md"),
  ]);

  return [...commands, ...skills];
}


async function listFilesRecursive(dir: string, ext: string): Promise<string[]> {
  try {
    await access(dir);
  } catch {
    return [];
  }

  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFilesRecursive(fullPath, ext);
      results.push(...nested);
    } else if (entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }

  return results;
}
