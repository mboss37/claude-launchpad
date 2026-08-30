import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../../lib/output.js";
import { readFileOrNull } from "../../lib/fs-utils.js";
import type { HarnessId } from "../../harness/types.js";

export async function getConfigSnapshot(
  projectRoot: string,
  harnesses: ReadonlyArray<HarnessId>,
): Promise<string> {
  const files = await collectWatchedFiles(projectRoot, harnesses);
  const parts = await Promise.all(
    files.map(
      async (file) => `${file}:${(await readFileOrNull(file)) ?? "missing"}`,
    ),
  );
  return parts.join("|");
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
  try {
    await stat(dir);
  } catch {
    return [];
  }
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
}
