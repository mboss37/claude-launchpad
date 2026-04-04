import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { log } from "../../../lib/output.js";

/**
 * Require that resolves native deps from multiple locations:
 * 1. cwd's node_modules (local project install)
 * 2. Global node_modules (npm install -g)
 * 3. CLI's own resolution chain (fallback)
 */
export function cwdRequire(id: string): unknown {
  // Try local project first
  try {
    const localRequire = createRequire(join(process.cwd(), "package.json"));
    return localRequire(id);
  } catch { /* not in local */ }

  // Try global node_modules
  try {
    const globalPrefix = execSync("npm config get prefix", { encoding: "utf-8" }).trim();
    const globalRequire = createRequire(join(globalPrefix, "lib", "node_modules", "package.json"));
    return globalRequire(id);
  } catch { /* not in global */ }

  throw new Error(`Cannot find module '${id}' in local or global node_modules`);
}

/**
 * Check if memory native dependencies are available.
 * Called at the start of any subcommand that needs SQLite.
 * Returns true if deps are available, exits with helpful message if not.
 */
export async function requireMemoryDeps(): Promise<boolean> {
  try {
    cwdRequire("better-sqlite3");
    return true;
  } catch {
    log.blank();
    log.error("Memory system requires native dependencies that are not installed.");
    log.blank();
    log.info("Run this to install them:");
    log.blank();
    log.step("  npm install -g better-sqlite3 sqlite-vec");
    log.blank();
    log.info("This requires a C++ compiler (Xcode on macOS, build-essential on Linux).");
    log.info("After installing, run `claude-launchpad memory` again.");
    log.blank();
    process.exit(1);
  }
}

