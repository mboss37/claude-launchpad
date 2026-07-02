import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * Detect an installed superpowers plugin (any marketplace) with a shallow
 * scan of ~/.claude/plugins. Best-effort: layout differences or a missing
 * directory simply mean "not detected" — this only gates an INFO nudge.
 */
export function isSuperpowersInstalled(): boolean {
  const pluginsDir = join(homedir(), ".claude", "plugins");
  if (!existsSync(pluginsDir)) return false;
  try {
    return dirTreeContains(pluginsDir, "superpowers", 3);
  } catch {
    return false;
  }
}

function dirTreeContains(dir: string, needle: string, depth: number): boolean {
  if (depth === 0) return false;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.toLowerCase().includes(needle)) return true;
    if (dirTreeContains(join(dir, entry.name), needle, depth - 1)) return true;
  }
  return false;
}
