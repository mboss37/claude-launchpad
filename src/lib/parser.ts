import { readdir, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readFileOrNull } from "./fs-utils.js";
import { log } from "./output.js";
import type { ClaudeConfig, HookConfig, McpServerConfig } from "../types/index.js";

const CLAUDE_MD = "CLAUDE.md";
const CLAUDE_DIR = ".claude";
const SETTINGS_FILE = "settings.json";
const SETTINGS_LOCAL_FILE = "settings.local.json";
const RULES_DIR = "rules";

export async function parseClaudeConfig(projectRoot: string): Promise<ClaudeConfig> {
  const root = resolve(projectRoot);
  const claudeDir = join(root, CLAUDE_DIR);

  const [claudeMd, localClaudeMd, settings, localSettings, hooks, rules, mcpServers, skills, claudeignore] = await Promise.all([
    readClaudeMd(root),
    readFileOrNull(join(claudeDir, CLAUDE_MD)),
    readSettings(claudeDir),
    readSettingsFromFile(claudeDir, SETTINGS_LOCAL_FILE),
    readHooks(claudeDir),
    readRules(claudeDir),
    readMcpServers(claudeDir, root),
    readSkills(claudeDir),
    readFileOrNull(join(root, ".claudeignore")),
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
    localClaudeMdContent: localClaudeMd,
    localSettings,
    hooks,
    rules,
    mcpServers,
    skills,
    claudeignorePath: claudeignore !== null ? join(root, ".claudeignore") : null,
    claudeignoreContent: claudeignore,
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
  return readSettingsFromFile(claudeDir, SETTINGS_FILE);
}

async function readSettingsFromFile(claudeDir: string, filename: string): Promise<Record<string, unknown> | null> {
  const path = join(claudeDir, filename);
  const raw = await readFileOrNull(path);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    log.warnOnce(`parse:${path}`, `${path} is not valid JSON: ${(err as Error).message}. Treating as unreadable to avoid clobbering it.`);
    return null;
  }
}

// ─── Hooks ───

async function readHooks(claudeDir: string): Promise<ReadonlyArray<HookConfig>> {
  const [shared, local] = await Promise.all([
    readHooksFromFile(join(claudeDir, SETTINGS_FILE)),
    readHooksFromFile(join(claudeDir, SETTINGS_LOCAL_FILE)),
  ]);
  return [...shared, ...local];
}

async function readHooksFromFile(settingsPath: string): Promise<ReadonlyArray<HookConfig>> {
  const settingsRaw = await readFileOrNull(settingsPath);
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

        const nestedHooks = g.hooks as Record<string, unknown>[] | undefined;
        if (Array.isArray(nestedHooks)) {
          for (const hook of nestedHooks) {
            const h = hook as Record<string, unknown>;
            result.push({
              event: event as HookConfig["event"],
              type: (h.type as HookConfig["type"]) ?? "command",
              matcher,
              command: h.command as string | undefined,
              timeout: h.timeout as number | undefined,
            });
          }
        } else {
          result.push({
            event: event as HookConfig["event"],
            type: (g.type as HookConfig["type"]) ?? "command",
            matcher,
            command: g.command as string | undefined,
            timeout: g.timeout as number | undefined,
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

async function readMcpServers(claudeDir: string, projectRoot: string): Promise<ReadonlyArray<McpServerConfig>> {
  const [fromMcpJson, fromSettings, fromLocalSettings] = await Promise.all([
    readMcpJsonFile(join(projectRoot, ".mcp.json")),
    readMcpServersFromSettings(join(claudeDir, SETTINGS_FILE)),
    readMcpServersFromSettings(join(claudeDir, SETTINGS_LOCAL_FILE)),
  ]);
  // Deduplicate by name — .mcp.json > local settings > shared settings
  const seen = new Set<string>();
  const result: McpServerConfig[] = [];
  for (const server of [...fromMcpJson, ...fromLocalSettings, ...fromSettings]) {
    if (!seen.has(server.name)) {
      seen.add(server.name);
      result.push(server);
    }
  }
  return result;
}

/** Read .mcp.json (project-scoped MCP config created by `claude mcp add --scope project`) */
async function readMcpJsonFile(mcpJsonPath: string): Promise<ReadonlyArray<McpServerConfig>> {
  const raw = await readFileOrNull(mcpJsonPath);
  if (raw === null) return [];

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const servers = parsed.mcpServers as Record<string, unknown> | undefined;
    if (!servers || typeof servers !== "object") return [];

    const result: McpServerConfig[] = [];
    for (const [name, config] of Object.entries(servers)) {
      const c = config as Record<string, unknown>;
      result.push({
        name,
        transport: ((c.transport ?? c.type) as McpServerConfig["transport"]) ?? "stdio",
        command: c.command as string | undefined,
        url: c.url as string | undefined,
      });
    }
    return result;
  } catch {
    return [];
  }
}

async function readMcpServersFromSettings(settingsPath: string): Promise<ReadonlyArray<McpServerConfig>> {
  const settingsRaw = await readFileOrNull(settingsPath);
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
        transport: ((c.transport ?? c.type) as McpServerConfig["transport"]) ?? "stdio",
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
