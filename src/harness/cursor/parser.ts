import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileExists, readFileOrNull } from "../../lib/fs-utils.js";
import { countInstructions } from "../../lib/parser.js";
import type { McpServerConfig } from "../../types/index.js";
import type {
  CursorConfig,
  CursorHookConfig,
  CursorParseError,
} from "./types.js";

const MARKDOWN_EXTS = [".mdc", ".md", ".markdown"] as const;

interface JsonRead {
  readonly existed: boolean;
  readonly value: Record<string, unknown> | null;
  readonly error: CursorParseError | null;
}

export async function parseCursorConfig(root: string): Promise<CursorConfig> {
  const cursorDir = join(root, ".cursor");
  const hooksFile = join(cursorDir, "hooks.json");
  const mcpFile = join(cursorDir, "mcp.json");
  const sandboxFile = join(cursorDir, "sandbox.json");
  const instructionsFile = join(root, "AGENTS.md");
  const ignoreFile = join(root, ".cursorignore");

  const [
    instructionsContent,
    ignoreContent,
    hooksJson,
    mcpJson,
    sandbox,
    rules,
    skills,
    agents,
  ] = await Promise.all([
    readFileOrNull(instructionsFile),
    readFileOrNull(ignoreFile),
    readJsonObject(hooksFile, ".cursor/hooks.json"),
    readJsonObject(mcpFile, ".cursor/mcp.json"),
    readJsonObject(sandboxFile, ".cursor/sandbox.json"),
    listMarkdownTree(join(cursorDir, "rules"), MARKDOWN_EXTS),
    listSkillFiles(join(cursorDir, "skills")),
    listMarkdownTree(join(cursorDir, "agents"), MARKDOWN_EXTS),
  ]);

  const hookShapeErrors = hookStructureErrors(hooksJson.value);

  return {
    instructionsPath: instructionsContent !== null ? instructionsFile : null,
    instructionsContent,
    instructionCount: instructionsContent
      ? countInstructions(instructionsContent)
      : 0,
    hooksPath: hooksJson.existed ? hooksFile : null,
    hooks: readCursorHooks(hooksJson.value),
    rules,
    skills,
    agents,
    mcpServers: readCursorMcp(mcpJson.value),
    ignorePath: ignoreContent !== null ? ignoreFile : null,
    ignoreContent,
    sandbox: sandbox.value,
    parseErrors: [
      hooksJson.error,
      mcpJson.error,
      sandbox.error,
      ...hookShapeErrors,
    ].filter((error): error is CursorParseError => error !== null),
  };
}

async function readJsonObject(
  path: string,
  relative: string,
): Promise<JsonRead> {
  const raw = await readFileOrNull(path);
  if (raw === null) return { existed: false, value: null, error: null };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return {
        existed: true,
        value: null,
        error: { path: relative, message: "Invalid JSON" },
      };
    }
    return {
      existed: true,
      value: parsed as Record<string, unknown>,
      error: null,
    };
  } catch {
    return {
      existed: true,
      value: null,
      error: { path: relative, message: "Invalid JSON" },
    };
  }
}

function hookStructureErrors(
  value: Record<string, unknown> | null,
): ReadonlyArray<CursorParseError> {
  if (value === null) return [];
  const hooks = value.hooks;
  if (hooks === undefined) return [];
  if (hooks === null || typeof hooks !== "object" || Array.isArray(hooks)) {
    return [{ path: ".cursor/hooks.json", message: "Invalid JSON" }];
  }
  return Object.entries(hooks as Record<string, unknown>).flatMap(
    ([event, list]) => {
      if (!Array.isArray(list)) {
        return [
          {
            path: ".cursor/hooks.json",
            message: `Malformed hook array for ${event}`,
          },
        ];
      }
      return list.some(
        (entry) =>
          entry === null || typeof entry !== "object" || Array.isArray(entry),
      )
        ? [
            {
              path: ".cursor/hooks.json",
              message: `Malformed hook entry in ${event}`,
            },
          ]
        : [];
    },
  );
}

function readCursorHooks(
  value: Record<string, unknown> | null,
): ReadonlyArray<CursorHookConfig> {
  if (value === null) return [];
  const hooks = value.hooks;
  if (hooks === null || typeof hooks !== "object" || Array.isArray(hooks))
    return [];
  return Object.entries(hooks as Record<string, unknown>).flatMap(
    ([event, list]) => flattenCursorHooks(event, list),
  );
}

function flattenCursorHooks(
  event: string,
  list: unknown,
): ReadonlyArray<CursorHookConfig> {
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry))
      return [];
    const hook = entry as Record<string, unknown>;
    return [
      {
        event,
        type: (typeof hook.type === "string"
          ? hook.type
          : "command") as CursorHookConfig["type"],
        command: typeof hook.command === "string" ? hook.command : undefined,
        failClosed: hook.failClosed === true,
        timeout: typeof hook.timeout === "number" ? hook.timeout : undefined,
      },
    ];
  });
}

function readCursorMcp(
  value: Record<string, unknown> | null,
): ReadonlyArray<McpServerConfig> {
  if (value === null) return [];
  const servers = value.mcpServers;
  if (servers === null || typeof servers !== "object" || Array.isArray(servers))
    return [];
  return Object.entries(servers as Record<string, unknown>).map(
    ([name, config]) => {
      const entry =
        config !== null && typeof config === "object" && !Array.isArray(config)
          ? (config as Record<string, unknown>)
          : {};
      return {
        name,
        transport:
          ((entry.transport ?? entry.type) as McpServerConfig["transport"]) ??
          "stdio",
        command: typeof entry.command === "string" ? entry.command : undefined,
        url: typeof entry.url === "string" ? entry.url : undefined,
      };
    },
  );
}

async function listMarkdownTree(
  dir: string,
  extensions: ReadonlyArray<string>,
): Promise<ReadonlyArray<string>> {
  if (!(await fileExists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => listMarkdownTree(join(dir, entry.name), extensions)),
  );
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext)),
    )
    .map((entry) => join(dir, entry.name));
  return [...files, ...nested.flat()];
}

async function listSkillFiles(dir: string): Promise<ReadonlyArray<string>> {
  return (await listMarkdownTree(dir, [".md"])).filter((path) =>
    path.endsWith("SKILL.md"),
  );
}
