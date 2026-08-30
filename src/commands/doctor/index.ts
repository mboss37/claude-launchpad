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
import type { HarnessId } from "../../harness/types.js";
import {
  detectHarnesses,
  parseHarnessSelection,
  resolveHarnesses,
} from "../../harness/registry.js";
import { parseCursorConfig } from "../../harness/cursor/parser.js";
import { runCursorAnalyzers } from "../../harness/cursor/doctor.js";

export const CURSOR_FIX_UNAVAILABLE =
  "Cursor --fix is not available yet. Run doctor without --fix for diagnostics.";

/**
 * Only reject --fix when Cursor is the sole target. When Claude is also in
 * scope (explicit both, or auto-detection finding both surfaces) the Claude
 * fixes must keep working — Cursor issues are reported without fixes.
 */
export function guardCursorFix(
  harnesses: ReadonlyArray<HarnessId>,
  fix: boolean,
): void {
  if (fix && harnesses.includes("cursor") && !harnesses.includes("claude")) {
    throw new Error(CURSOR_FIX_UNAVAILABLE);
  }
}

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Diagnose your coding agent configuration and report issues")
    .option("-p, --path <path>", "Project root path", process.cwd())
    .option("--json", "Output as JSON")
    .option(
      "--min-score <n>",
      "Exit non-zero if overall score is below this threshold (for CI)",
    )
    .option("--fix", "Auto-apply deterministic fixes for detected issues")
    .option("--dry-run", "Preview what --fix would change without applying")
    .option("--watch", "Watch for config changes and re-run automatically")
    .option(
      "--harness <harness>",
      "Target harness: auto, claude, cursor, or both",
      "auto",
    )
    .action(async (opts) => {
      const selection = parseHarnessSelection(String(opts.harness));
      const detected = await detectHarnesses(opts.path);
      const harnesses = resolveHarnesses(selection, detected);

      if (opts.watch) {
        await watchConfig(opts.path, harnesses, async () => {
          await scanAndRender(opts.path, harnesses, {
            json: false,
            silentEmpty: true,
          });
        });
        return;
      }

      try {
        guardCursorFix(harnesses, Boolean(opts.fix));
      } catch (error) {
        log.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }

      if (harnesses.length === 0) {
        if (!opts.json) {
          printBanner();
          log.error("No Claude Code configuration found in this directory.");
          log.info(
            "Run `claude-launchpad init` to set up a project, or cd into a configured project.",
          );
        }
        process.exit(1);
      }

      if (harnesses.length === 1 && harnesses[0] === "claude") {
        await runClaudeDoctor(opts);
        return;
      }

      if (harnesses.length === 1 && harnesses[0] === "cursor") {
        await runCursorDoctor(opts);
        return;
      }

      await runBothDoctor(opts);
    });
}

async function runClaudeDoctor(opts: DoctorOpts): Promise<void> {
  if (!opts.json) {
    printBanner();
    log.step("Scanning Claude Code configuration...");
    log.blank();
  }

  const config = await parseClaudeConfig(opts.path);
  if (config.claudeMdContent === null && config.settings === null) {
    log.error("No Claude Code configuration found in this directory.");
    log.info(
      "Run `claude-launchpad init` to set up a project, or cd into a configured project.",
    );
    process.exit(1);
  }

  const results = await runClaudeAnalyzers(config, opts.path);
  await finishClaudeReport(results, opts);
}

async function runCursorDoctor(opts: DoctorOpts): Promise<void> {
  if (!opts.json) {
    printBanner();
    log.step("Scanning Cursor Agent configuration...");
    log.blank();
  }
  const results = [
    ...(await runCursorAnalyzers(
      await parseCursorConfig(opts.path),
      opts.path,
    )),
  ];
  const overallScore = averageScore(results);
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          overallScore,
          analyzers: results,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    exitOnMinScore(opts.minScore, overallScore);
    return;
  }
  renderDoctorReport(results);
  exitOnMinScore(opts.minScore, overallScore);
}

async function runBothDoctor(opts: DoctorOpts): Promise<void> {
  const claudeResults = await runClaudeAnalyzers(
    await parseClaudeConfig(opts.path),
    opts.path,
  );
  const cursorResults = [
    ...(await runCursorAnalyzers(
      await parseCursorConfig(opts.path),
      opts.path,
    )),
  ];
  const cursorScore = averageScore(cursorResults);
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          harnesses: {
            claude: {
              overallScore: averageScore(claudeResults),
              analyzers: claudeResults,
            },
            cursor: {
              overallScore: cursorScore,
              analyzers: cursorResults,
            },
          },
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    // Never averaged: the gate fails if either harness is below threshold.
    exitOnMinScore(opts.minScore, averageScore(claudeResults));
    exitOnMinScore(opts.minScore, cursorScore);
    return;
  }
  printBanner();
  log.step("Scanning Claude Code and Cursor Agent configuration...");
  log.blank();
  console.log(chalk.bold("  Claude Code"));
  log.blank();
  let claudeScore = averageScore(claudeResults);
  if (opts.fix) {
    await applyClaudeFixes(claudeResults, opts);
    claudeScore = averageScore(
      await runClaudeAnalyzers(await parseClaudeConfig(opts.path), opts.path),
    );
  } else {
    renderDoctorReport(claudeResults);
  }
  log.blank();
  console.log(chalk.bold("  Cursor Agent"));
  log.blank();
  if (opts.fix) log.warn(CURSOR_FIX_UNAVAILABLE);
  renderDoctorReport(cursorResults);
  exitOnMinScore(opts.minScore, claudeScore);
  exitOnMinScore(opts.minScore, cursorScore);
}

async function scanAndRender(
  path: string,
  harnesses: ReadonlyArray<HarnessId>,
  options: { json: boolean; silentEmpty: boolean },
): Promise<void> {
  void options;
  if (harnesses.includes("claude")) {
    const results = await runClaudeAnalyzers(
      await parseClaudeConfig(path),
      path,
    );
    console.log(chalk.bold("  Claude Code"));
    renderDoctorReport(results);
  }
  if (harnesses.includes("cursor")) {
    const results = [
      ...(await runCursorAnalyzers(await parseCursorConfig(path), path)),
    ];
    console.log(chalk.bold("  Cursor Agent"));
    renderDoctorReport(results);
  }
}

interface DoctorOpts {
  readonly path: string;
  readonly json?: boolean;
  readonly minScore?: string;
  readonly fix?: boolean;
  readonly dryRun?: boolean;
}

async function finishClaudeReport(
  results: AnalyzerResult[],
  opts: DoctorOpts,
): Promise<void> {
  if (opts.json) {
    const overallScore = averageScore(results);
    console.log(
      JSON.stringify(
        {
          overallScore,
          analyzers: results,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    return;
  }

  let overallScore = averageScore(results);
  if (!opts.fix) renderDoctorReport(results);

  if (opts.fix) {
    await applyClaudeFixes(results, opts);
    overallScore = averageScore(
      await runClaudeAnalyzers(await parseClaudeConfig(opts.path), opts.path),
    );
  }

  exitOnMinScore(opts.minScore, overallScore);
}

async function applyClaudeFixes(
  results: AnalyzerResult[],
  opts: DoctorOpts,
): Promise<void> {
  const allIssues = results.flatMap((result) => result.issues);
  const fixable = allIssues.filter((issue) => issue.severity !== "info");
  if (fixable.length === 0) {
    renderDoctorReport(results);
    log.success("Nothing to fix.");
    return;
  }
  if (opts.dryRun) {
    const withFix = fixable.filter((issue) => issue.fix);
    log.blank();
    log.step("Dry run — would apply:");
    log.blank();
    for (const issue of withFix) log.info(`  ${issue.fix}`);
    log.blank();
    log.success(
      `${withFix.length} fix(es) available. Run --fix without --dry-run to apply.`,
    );
    return;
  }

  log.blank();
  log.step("Applying fixes...");
  log.blank();
  let updatedResults = results;
  let pending = fixable;
  let totalFixed = 0;
  for (let pass = 0; pass < 3 && pending.length > 0; pass++) {
    const { fixed } = await applyFixes(pending, opts.path);
    totalFixed += fixed;
    updatedResults = await runClaudeAnalyzers(
      await parseClaudeConfig(opts.path),
      opts.path,
    );
    if (fixed === 0) break;
    pending = updatedResults
      .flatMap((result) => result.issues)
      .filter((issue) => issue.severity !== "info");
  }
  if (totalFixed > 0) {
    log.blank();
    log.success(`Applied ${totalFixed} fix(es). Re-scanning...`);
    log.blank();
  }
  renderDoctorReport(updatedResults, { afterFix: true });
  log.info(
    `Then use ${chalk.bold("/lp-enhance")} inside Claude Code to have Claude restructure and complete your CLAUDE.md.`,
  );
}

async function runClaudeAnalyzers(
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

function averageScore(results: ReadonlyArray<AnalyzerResult>): number {
  if (results.length === 0) return 0;
  return Math.round(
    results.reduce((sum, result) => sum + result.score, 0) / results.length,
  );
}

function exitOnMinScore(
  minScore: string | undefined,
  overallScore: number,
): void {
  if (!minScore) return;
  const threshold = Number.parseInt(minScore, 10);
  if (overallScore < threshold) process.exit(1);
}
