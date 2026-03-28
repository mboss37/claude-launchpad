import { watch } from "node:fs";
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
 * Watch .claude/ and CLAUDE.md for changes. Re-run doctor on every save.
 * Clears screen and shows live score.
 */
export async function watchConfig(projectRoot: string): Promise<void> {
  const claudeDir = join(projectRoot, ".claude");
  const claudeMd = join(projectRoot, "CLAUDE.md");
  const claudeignore = join(projectRoot, ".claudeignore");

  // Initial run
  await runAndDisplay(projectRoot);

  log.blank();
  log.info("Watching for changes... (Ctrl+C to stop)");
  log.blank();

  let debounce: ReturnType<typeof setTimeout> | null = null;

  const onChange = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(async () => {
      console.clear();
      await runAndDisplay(projectRoot);
      log.blank();
      log.info("Watching for changes... (Ctrl+C to stop)");
      log.blank();
    }, 300);
  };

  // Watch .claude/ directory
  try {
    watch(claudeDir, { recursive: true }, onChange);
  } catch {
    // .claude/ might not exist yet
  }

  // Watch CLAUDE.md
  try {
    watch(claudeMd, onChange);
  } catch {
    // CLAUDE.md might not exist yet
  }

  // Watch .claudeignore
  try {
    watch(claudeignore, onChange);
  } catch {
    // .claudeignore might not exist yet
  }

  // Keep process alive
  await new Promise(() => {});
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
