import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessId, HarnessSelection } from "./types.js";

const VALID = new Set<HarnessSelection>(["auto", "claude", "cursor", "both"]);

export function parseHarnessSelection(value: string): HarnessSelection {
  if (VALID.has(value as HarnessSelection)) return value as HarnessSelection;
  throw new Error("Harness must be one of: auto, claude, cursor, both");
}

export async function detectHarnesses(
  root: string,
): Promise<ReadonlyArray<HarnessId>> {
  const [claude, cursor] = await Promise.all([
    exists(join(root, "CLAUDE.md"), join(root, ".claude", "settings.json")),
    detectCursorConfig(root),
  ]);
  return [
    ...(claude ? ["claude" as const] : []),
    ...(cursor ? ["cursor" as const] : []),
  ];
}

/**
 * A bare `.cursor/` directory is not evidence of Cursor Agent configuration —
 * the Cursor IDE creates one (mcp.json, cache) in plenty of Claude-only
 * repos. Require an actual agent surface: AGENTS.md, hooks.json, or rules.
 */
async function detectCursorConfig(root: string): Promise<boolean> {
  if (
    await exists(join(root, "AGENTS.md"), join(root, ".cursor", "hooks.json"))
  ) {
    return true;
  }
  try {
    const entries = await readdir(join(root, ".cursor", "rules"));
    return entries.some((entry) => entry.endsWith(".mdc"));
  } catch {
    return false;
  }
}

export function resolveHarnesses(
  selection: HarnessSelection,
  detected: ReadonlyArray<HarnessId>,
): ReadonlyArray<HarnessId> {
  if (selection === "both") return ["claude", "cursor"];
  if (selection === "auto") return [...detected];
  return [selection];
}

async function exists(...paths: ReadonlyArray<string>): Promise<boolean> {
  const checks = await Promise.all(
    paths.map((path) =>
      access(path)
        .then(() => true)
        .catch(() => false),
    ),
  );
  return checks.some(Boolean);
}
