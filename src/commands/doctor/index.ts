import { Command } from "commander";
import chalk from "chalk";
import { printBanner, log, renderDoctorReport } from "../../lib/output.js";
import { parseClaudeConfig } from "../../lib/parser.js";
import { analyzeBudget } from "./analyzers/budget.js";
import { analyzeSettings } from "./analyzers/settings.js";
import { analyzeHooks } from "./analyzers/hooks.js";
import { analyzeRules } from "./analyzers/rules.js";
import { analyzePermissions } from "./analyzers/permissions.js";
import { analyzeMcp } from "./analyzers/mcp.js";
import { analyzeQuality } from "./analyzers/quality.js";
import { analyzeMemory } from "./analyzers/memory.js";
import { analyzeWorkflow } from "./analyzers/workflow.js";
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

      const results = await runAnalyzers(config, opts.path);

      if (opts.json) {
        const overallScore = Math.round(
          results.reduce((sum, r) => sum + r.score, 0) / results.length,
        );
        console.log(JSON.stringify({ overallScore, analyzers: results, timestamp: new Date().toISOString() }, null, 2));
        return;
      }

      // Skip rendering the initial report when --fix is used — only show the post-fix result
      let overallScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
      if (!opts.fix) {
        renderDoctorReport(results);
      }

      // Auto-fix mode
      if (opts.fix) {
        const allIssues = results.flatMap((r) => r.issues);
        const fixable = allIssues.filter((i) => i.severity !== "info");
        if (fixable.length === 0) {
          renderDoctorReport(results);
          log.success("Nothing to fix.");
        } else if (fixable.length > 0) {
          // Dry-run: preview only
          if (opts.dryRun) {
            const withFix = fixable.filter((i) => i.fix);
            log.blank();
            log.step("Dry run — would apply:");
            log.blank();
            for (const issue of withFix) {
              log.info(`  ${issue.fix}`);
            }
            const skipped = fixable.length - withFix.length;
            log.blank();
            log.success(`${withFix.length} fix(es) available. Run --fix without --dry-run to apply.`);
            if (skipped > 0) {
              log.info(`${skipped} issue(s) require manual intervention.`);
            }
            log.info(`Then use ${chalk.bold("/lp-enhance")} inside Claude Code to have Claude restructure and complete your CLAUDE.md.`);
            return;
          }

          log.blank();
          log.step("Applying fixes...");
          log.blank();

          // Fix to a fixed point: a fix can unlock checks gated on artifacts it
          // creates (e.g. sprint hooks activate once a TASKS.md hook exists), so
          // re-scan and re-apply until nothing new is fixed (bounded).
          let updatedResults = results;
          let pending = fixable;
          let totalFixed = 0;
          for (let pass = 0; pass < 3 && pending.length > 0; pass++) {
            const { fixed } = await applyFixes(pending, opts.path);
            totalFixed += fixed;
            updatedResults = await runAnalyzers(await parseClaudeConfig(opts.path), opts.path);
            if (fixed === 0) break;
            pending = updatedResults.flatMap((r) => r.issues).filter((i) => i.severity !== "info");
          }
          if (totalFixed > 0) {
            log.blank();
            log.success(`Applied ${totalFixed} fix(es). Re-scanning...`);
            log.blank();
          }

          renderDoctorReport(updatedResults, { afterFix: true });
          log.info(`Then use ${chalk.bold("/lp-enhance")} inside Claude Code to have Claude restructure and complete your CLAUDE.md.`);
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

async function runAnalyzers(
  config: Awaited<ReturnType<typeof parseClaudeConfig>>,
  path: string,
): Promise<AnalyzerResult[]> {
  const results: AnalyzerResult[] = await Promise.all([
    analyzeBudget(config),
    analyzeQuality(config, path),
    analyzeSettings(config),
    analyzeHooks(config, path),
    analyzeRules(config),
    analyzePermissions(config, path),
    analyzeMcp(config),
  ]);
  const workflowResult = await analyzeWorkflow(path);
  if (workflowResult) results.push(workflowResult);
  const memoryResult = await analyzeMemory(config, path);
  if (memoryResult) results.push(memoryResult);
  return results;
}
