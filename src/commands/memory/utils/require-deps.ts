import { log } from "../../../lib/output.js";

/**
 * Check if memory native dependencies are available.
 * Called at the start of any subcommand that needs SQLite.
 * Returns true if deps are available, exits with helpful message if not.
 */
export async function requireMemoryDeps(): Promise<boolean> {
  try {
    await import("better-sqlite3");
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
