import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../../lib/output.js";
import type { HarnessId } from "../../harness/types.js";

/**
 * Stat-based fingerprint (mtime ns + size per file) — the watcher polls every
 * second, and .claude/ or .cursor/ can hold megabytes of sessions/memory, so
 * reading contents on each tick is not acceptable.
 */
export async function getConfigSnapshot(
  projectRoot: string,
  harnesses: ReadonlyArray<HarnessId>,
): Promise<string> {
  const files = await collectWatchedFiles(projectRoot, harnesses);
  const parts = await Promise.all(files.map(fingerprintFile));
  return parts.join("|");
}

async function fingerprintFile(file: string): Promise<string> {
  try {
    const stats = await stat(file, { bigint: true });
    return `${file}:${stats.mtimeNs}:${stats.size}`;
  } catch {
    return `${file}:missing`;
  }
}

export async function watchConfig(
  projectRoot: string,
  harnesses: ReadonlyArray<HarnessId>,
  scanAndRender: () => Promise<void>,
): Promise<void> {
  await scanAndRender();
  log.blank();
  log.info("Watching for changes... (Ctrl+C to stop)");
  log.blank();

  let lastSnapshot = await getConfigSnapshot(projectRoot, harnesses);
  setInterval(async () => {
    const currentSnapshot = await getConfigSnapshot(projectRoot, harnesses);
    if (currentSnapshot !== lastSnapshot) {
      lastSnapshot = currentSnapshot;
      console.clear();
      await scanAndRender();
      log.blank();
      log.info("Watching for changes... (Ctrl+C to stop)");
      log.blank();
    }
  }, 1000);

  await new Promise(() => {});
}

async function collectWatchedFiles(
  projectRoot: string,
  harnesses: ReadonlyArray<HarnessId>,
): Promise<ReadonlyArray<string>> {
  const files: string[] = [];
  if (harnesses.includes("claude")) {
    files.push(
      join(projectRoot, "CLAUDE.md"),
      join(projectRoot, ".claudeignore"),
    );
    files.push(...(await listFilesRecursive(join(projectRoot, ".claude"))));
  }
  if (harnesses.includes("cursor")) {
    files.push(
      join(projectRoot, "AGENTS.md"),
      join(projectRoot, ".cursorignore"),
    );
    files.push(...(await listFilesRecursive(join(projectRoot, ".cursor"))));
  }
  return files;
}

async function listFilesRecursive(dir: string): Promise<ReadonlyArray<string>> {
  // readdir must stay inside the try: this runs in a setInterval callback,
  // where an unhandled rejection (e.g. ENOTDIR) would crash the process.
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const nested = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => listFilesRecursive(join(dir, entry.name))),
    );
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => join(dir, entry.name));
    return [...files, ...nested.flat()];
  } catch {
    return [];
  }
}
