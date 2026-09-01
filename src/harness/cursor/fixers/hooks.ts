import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DetectedProject } from "../../../types/index.js";
import { fileExists, readFileOrNull } from "../../../lib/fs-utils.js";
import { generateCursorHooks } from "../generators.js";
import {
  autoFormatScript,
  CURSOR_HOOK_VERSION,
  destructiveShellScript,
  envReadScript,
  sessionContextScript,
  sprintOpenScript,
  sprintSizeScript,
  workflowCheckScript,
} from "../hook-scripts.js";
import { mergeCursorHooks } from "../merge.js";

const HOOKS_PATH = ".cursor/hooks.json";

export async function createOrMergeCursorHooks(
  root: string,
  detected: DetectedProject,
): Promise<boolean> {
  const path = join(root, HOOKS_PATH);
  const existingRaw = await readFileOrNull(path);
  const existing = parseHooksDocument(existingRaw);
  if (existing === null || !isMergeableHooksDocument(existing)) return false;
  const generated = generateCursorHooks(detected) as unknown as Record<
    string,
    unknown
  >;
  let merged: Record<string, unknown>;
  try {
    merged = mergeCursorHooks(existing, generated);
  } catch {
    return false;
  }
  const next = `${JSON.stringify(merged, null, 2)}\n`;
  if (next === existingRaw) return false;
  await mkdir(join(root, ".cursor"), { recursive: true });
  await writeFile(path, next);
  return true;
}

export async function refreshCursorHookScripts(
  root: string,
  detected: DetectedProject,
): Promise<boolean> {
  const hooksDir = join(root, ".cursor", "hooks");
  await mkdir(hooksDir, { recursive: true });
  let changed = false;
  for (const [name, content] of launchpadScripts(detected.language)) {
    const path = join(hooksDir, name);
    if (await shouldWriteScript(path, content)) {
      await writeFile(path, content);
      await chmod(path, 0o755);
      changed = true;
    }
  }
  return changed;
}

function launchpadScripts(
  language: string | null,
): ReadonlyArray<readonly [string, string]> {
  return [
    ["env-read.sh", envReadScript()],
    ["destructive-shell.sh", destructiveShellScript()],
    ["auto-format.sh", autoFormatScript(language)],
    ["workflow-check.sh", workflowCheckScript()],
    ["sprint-open.sh", sprintOpenScript()],
    ["session-context.sh", sessionContextScript()],
    ["sprint-size.sh", sprintSizeScript()],
  ];
}

async function shouldWriteScript(
  path: string,
  generated: string,
): Promise<boolean> {
  if (!(await fileExists(path))) return true;
  const existing = (await readFileOrNull(path)) ?? "";
  if (!existing.includes("lp-cursor-hook-version")) return false;
  return existing !== generated;
}

export function expectedHookVersion(): number {
  return CURSOR_HOOK_VERSION;
}

function isMergeableHooksDocument(doc: Record<string, unknown>): boolean {
  const hooks = doc.hooks;
  if (hooks === undefined) return true;
  if (hooks === null || typeof hooks !== "object" || Array.isArray(hooks)) {
    return false;
  }
  return Object.values(hooks as Record<string, unknown>).every(
    (list) =>
      Array.isArray(list) &&
      list.every(
        (entry) =>
          entry !== null && typeof entry === "object" && !Array.isArray(entry),
      ),
  );
}

function parseHooksDocument(
  raw: string | null,
): Record<string, unknown> | null {
  if (raw === null) return { version: 1, hooks: {} };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
