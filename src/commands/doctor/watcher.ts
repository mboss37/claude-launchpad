import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseClaudeConfig } from "../../lib/parser.js";
import { log, renderDoctorReport } from "../../lib/output.js";
import { analyzeBudget } from "./analyzers/budget.js";
import { analyzeSettings } from "./analyzers/settings.js";
import { analyzeHooks } from "./analyzers/hooks.js";
import { analyzeRules } from "./analyzers/rules.js";
import { analyzePermissions } from "./analyzers/permissions.js";
import { analyzeMcp } from "./analyzers/mcp.js";
import { analyzeQuality } from "./analyzers/quality.js";
import type { AnalyzerResult } from "../../types/index.js";

/**
 * Watch config files for changes using polling (reliable on all OS).
 * Re-runs doctor on every detected change.
 */
export async function watchConfig(projectRoot: string): Promise<void> {
  await runAndDisplay(projectRoot);

  log.blank();
  log.info("Watching for changes... (Ctrl+C to stop)");
  log.blank();

  let lastSnapshot = await getFileSnapshot(projectRoot);

  setInterval(async () => {
    const currentSnapshot = await getFileSnapshot(projectRoot);
    if (currentSnapshot !== lastSnapshot) {
      lastSnapshot = currentSnapshot;
      console.clear();
      await runAndDisplay(projectRoot);
      log.blank();
      log.info("Watching for changes... (Ctrl+C to stop)");
      log.blank();
    }
  }, 1000);

  await new Promise(() => {});
}

async function getFileSnapshot(projectRoot: string): Promise<string> {
  const files = [
    join(projectRoot, "CLAUDE.md"),
    join(projectRoot, ".claudeignore"),
  ];

  const claudeDir = join(projectRoot, ".claude");
  try {
    const entries = await readdir(claudeDir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const parentPath = (entry as unknown as { parentPath?: string }).parentPath ?? claudeDir;
        files.push(join(parentPath, entry.name));
      }
    }
  } catch {
    // .claude/ doesn't exist
  }

  const mtimes: string[] = [];
  for (const file of files) {
    try {
      const s = await stat(file);
      mtimes.push(`${file}:${s.mtimeMs}`);
    } catch {
      mtimes.push(`${file}:missing`);
    }
  }

  return mtimes.join("|");
}

async function runAndDisplay(projectRoot: string): Promise<void> {
  console.log("\x1b[36m\x1b[1m  Claude Launchpad\x1b[0m");
  console.log("\x1b[2m  Scaffold · Diagnose · Evaluate · Remember\x1b[0m");
  log.blank();

  const config = await parseClaudeConfig(projectRoot);

  if (config.claudeMdContent === null && config.settings === null) {
    log.error("No Claude Code configuration found.");
    return;
  }

  const results: AnalyzerResult[] = await Promise.all([
    analyzeBudget(config),
    analyzeQuality(config, projectRoot),
    analyzeSettings(config),
    analyzeHooks(config),
    analyzeRules(config),
    analyzePermissions(config),
    analyzeMcp(config),
  ]);

  renderDoctorReport(results);
}
