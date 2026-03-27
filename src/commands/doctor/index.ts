import { Command } from "commander";
import { printBanner, log, printScoreCard, printIssue } from "../../lib/output.js";
import { parseClaudeConfig } from "../../lib/parser.js";
import { analyzeBudget } from "./analyzers/budget.js";
import { analyzeSettings } from "./analyzers/settings.js";
import { analyzeHooks } from "./analyzers/hooks.js";
import { analyzeRules } from "./analyzers/rules.js";
import { analyzePermissions } from "./analyzers/permissions.js";
import { analyzeMcp } from "./analyzers/mcp.js";
import { analyzeQuality } from "./analyzers/quality.js";
import type { AnalyzerResult, DiagnosticIssue } from "../../types/index.js";

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Diagnose your Claude Code configuration and report issues")
    .option("-p, --path <path>", "Project root path", process.cwd())
    .option("--json", "Output as JSON")
    .option("--min-score <n>", "Exit non-zero if overall score is below this threshold (for CI)")
    .action(async (opts) => {
      printBanner();
      log.step("Scanning Claude Code configuration...");
      log.blank();

      const config = await parseClaudeConfig(opts.path);

      if (config.claudeMdContent === null && config.settings === null) {
        log.error("No Claude Code configuration found in this directory.");
        log.info("Run `claude-launchpad init` to set up a project, or cd into a configured project.");
        process.exit(1);
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

      if (opts.json) {
        const overallScore = Math.round(
          results.reduce((sum, r) => sum + r.score, 0) / results.length,
        );
        console.log(JSON.stringify({ overallScore, analyzers: results, timestamp: new Date().toISOString() }, null, 2));
        return;
      }

      renderReport(results);

      // CI mode: exit non-zero if score is below threshold
      if (opts.minScore) {
        const overallScore = Math.round(
          results.reduce((sum, r) => sum + r.score, 0) / results.length,
        );
        const threshold = parseInt(opts.minScore, 10);
        if (overallScore < threshold) {
          process.exit(1);
        }
      }
    });
}

function renderReport(results: ReadonlyArray<AnalyzerResult>): void {
  const overallScore = Math.round(
    results.reduce((sum, r) => sum + r.score, 0) / results.length,
  );

  // Score cards
  for (const result of results) {
    printScoreCard(result.name, result.score);
  }
  log.blank();
  printScoreCard("Overall", overallScore);
  log.blank();

  // Issues list
  const allIssues = results.flatMap((r) => r.issues);
  const actionable = allIssues.filter((i) => i.severity !== "info");

  if (actionable.length === 0) {
    log.success("No issues found. Your configuration looks solid.");
    return;
  }

  for (const issue of sortBySeverity(actionable)) {
    printIssue(issue.severity, issue.analyzer, issue.message, issue.fix);
  }

  log.info(`${actionable.length} issue(s) found. Fix critical/high first.`);
}

function sortBySeverity(issues: ReadonlyArray<DiagnosticIssue>): ReadonlyArray<DiagnosticIssue> {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return [...issues].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));
}
