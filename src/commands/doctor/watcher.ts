import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { parseClaudeConfig } from "../../lib/parser.js";
import { log, printScoreCard, printIssue } from "../../lib/output.js";
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
  // Initial run
  await runAndDisplay(projectRoot);

  log.blank();
  log.info("Watching for changes... (Ctrl+C to stop)");
  log.blank();

  // Track file mtimes for change detection
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

  // Keep process alive
  await new Promise(() => {});
}

/**
 * Get a snapshot of all config file mtimes as a string for comparison.
 */
async function getFileSnapshot(projectRoot: string): Promise<string> {
  const files = [
    join(projectRoot, "CLAUDE.md"),
    join(projectRoot, ".claudeignore"),
  ];

  // Add all files in .claude/
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
  console.log("\x1b[2m  Scaffold · Diagnose · Evaluate\x1b[0m");
  log.blank();

  const config = await parseClaudeConfig(projectRoot);

  if (config.claudeMdContent === null && config.settings === null) {
    log.error("No Claude Code configuration found.");
    return;
  }

  const results: AnalyzerResult[] = await Promise.all([
    analyzeBudget(config),
    analyzeQuality(config),
    analyzeSettings(config),
    analyzeHooks(config),
    analyzeRules(config),
    analyzePermissions(config),
    analyzeMcp(config),
  ]);

  const overallScore = Math.round(
    results.reduce((sum, r) => sum + r.score, 0) / results.length,
  );

  for (const result of results) {
    printScoreCard(result.name, result.score);
  }
  log.blank();
  printScoreCard("Overall", overallScore);
  log.blank();

  const allIssues = results.flatMap((r) => r.issues);
  const actionable = allIssues.filter((i) => i.severity !== "info");

  if (actionable.length === 0) {
    log.success("No issues found. Your configuration looks solid.");
    return;
  }

  const sorted = [...actionable].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  for (const issue of sorted) {
    printIssue(issue.severity, issue.analyzer, issue.message, issue.fix);
  }

  log.info(`${actionable.length} issue(s) found. Fix critical/high first.`);
}
