import { createRequire } from "node:module";
import { join } from "node:path";
import { log } from "../../../lib/output.js";

/**
 * Require that resolves native deps from cwd's node_modules first,
 * falling back to the CLI's own resolution (global install).
 * Evaluated lazily so process.cwd() is captured at call time, not import time.
 */
export function cwdRequire(id: string): unknown {
  const localRequire = createRequire(join(process.cwd(), "node_modules"));
  try {
    return localRequire(id);
  } catch {
    return require(id);
  }
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
    log.step("  npm install better-sqlite3 sqlite-vec");
    log.blank();
    log.info("This requires a C++ compiler (Xcode on macOS, build-essential on Linux).");
    log.info("After installing, run `claude-launchpad memory` again.");
    log.blank();
    process.exit(1);
  }
}

/**
 * Check if dashboard dependencies (blessed) are available.
 */
export async function requireDashboardDeps(): Promise<boolean> {
  try {
    cwdRequire("blessed");
    return true;
  } catch {
    log.blank();
    log.error("Dashboard requires the blessed package.");
    log.blank();
    log.info("Run this to install it:");
    log.blank();
    log.step("  npm install -g blessed");
    log.blank();
    process.exit(1);
  }
}
