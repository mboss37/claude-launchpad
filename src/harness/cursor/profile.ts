import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessProfile } from "../types.js";
import { parseCursorConfig } from "./parser.js";
import type { CursorConfig } from "./types.js";

export const cursorHarnessProfile: HarnessProfile<CursorConfig> = {
  id: "cursor",
  displayName: "Cursor Agent",
  detect: detectCursorConfig,
  parse: parseCursorConfig,
};

/**
 * A bare `.cursor/` directory is not evidence of Cursor Agent configuration —
 * the Cursor IDE creates one (mcp.json, cache) in plenty of Claude-only
 * repos. Require an actual agent surface: AGENTS.md, hooks.json, or rules.
 */
async function detectCursorConfig(root: string): Promise<boolean> {
  if (
    await existsAny(
      join(root, "AGENTS.md"),
      join(root, ".cursor", "hooks.json"),
    )
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

async function existsAny(...paths: ReadonlyArray<string>): Promise<boolean> {
  const checks = await Promise.all(
    paths.map((path) =>
      access(path)
        .then(() => true)
        .catch(() => false),
    ),
  );
  return checks.some(Boolean);
}
