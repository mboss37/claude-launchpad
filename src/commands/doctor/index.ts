import { Command } from "commander";
import { printBanner, log, renderDoctorReport } from "../../lib/output.js";
import { parseClaudeConfig } from "../../lib/parser.js";
import { analyzeBudget } from "./analyzers/budget.js";
import { analyzeSettings } from "./analyzers/settings.js";
import { analyzeHooks } from "./analyzers/hooks.js";
import { analyzeRules } from "./analyzers/rules.js";
import { analyzePermissions } from "./analyzers/permissions.js";
import { analyzeMcp } from "./analyzers/mcp.js";
import { analyzeQuality } from "./analyzers/quality.js";
import { applyFixes } from "./fixer.js";
import { watchConfig } from "./watcher.js";
import type { AnalyzerResult } from "../../types/index.js";

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Diagnose your Claude Code configuration and report issues")
    .option("-p, --path <path>", "Project root path", process.cwd())
    .option("--json", "Output as JSON")
    .option("--min-score <n>", "Exit non-zero if overall score is below this threshold (for CI)")
    .option("--fix", "Auto-apply deterministic fixes for detected issues")
    .option("--dry-run", "Preview what --fix would change without applying")
    .option("--watch", "Watch for config changes and re-run automatically")
    .action(async (opts) => {
      if (opts.watch) {
        await watchConfig(opts.path);
        return;
      }

      if (!opts.json) {
        printBanner();
        log.step("Scanning Claude Code configuration...");
        log.blank();
      }

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

      const { overallScore } = renderDoctorReport(results);

      // Auto-fix mode
      if (opts.fix) {
        const allIssues = results.flatMap((r) => r.issues);
        const fixable = allIssues.filter((i) => i.severity !== "info");
        if (fixable.length > 0) {
          // Dry-run: preview only
          if (opts.dryRun) {
            log.blank();
            log.step("Dry run — would apply these fixes:");
            log.blank();
            for (const issue of fixable) {
              log.info(`  Would fix: ${issue.message}`);
            }
            log.blank();
            log.success(`${fixable.length} fix(es) available. Run --fix without --dry-run to apply.`);
            return;
          }

          log.blank();
          log.step("Applying fixes...");
          log.blank();
          const { fixed, skipped } = await applyFixes(fixable, opts.path);
          log.blank();
          if (fixed > 0) {
            log.success(`Applied ${fixed} fix(es). Re-scanning...`);
            log.blank();

            // Re-scan to show updated score
            const updatedConfig = await parseClaudeConfig(opts.path);
            const updatedResults: AnalyzerResult[] = await Promise.all([
              analyzeBudget(updatedConfig),
              analyzeQuality(updatedConfig),
              analyzeSettings(updatedConfig),
              analyzeHooks(updatedConfig),
              analyzeRules(updatedConfig),
              analyzePermissions(updatedConfig),
              analyzeMcp(updatedConfig),
            ]);
            renderDoctorReport(updatedResults);
          }
          if (skipped > 0) {
            log.info(`${skipped} issue(s) require manual intervention.`);
          }
        }
      }

      // CI mode: exit non-zero if score is below threshold
      if (opts.minScore) {
        const threshold = parseInt(opts.minScore, 10);
        if (overallScore < threshold) {
          process.exit(1);
        }
      }
    });
}
