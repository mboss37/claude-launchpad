import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { printBanner, log, printScoreCard } from "../../lib/output.js";
import { loadScenarios } from "./loader.js";
import { runScenarioWithRetries } from "./runner.js";
import type { EvalRunResult } from "../../types/index.js";

export function createEvalCommand(): Command {
  return new Command("eval")
    .description("Test your Claude Code config against eval scenarios")
    .option("-s, --suite <suite>", "Eval suite to run (e.g., security, conventions, workflow)")
    .option("-p, --path <path>", "Project root path", process.cwd())
    .option("--scenarios <path>", "Custom scenarios directory")
    .option("--runs <n>", "Runs per scenario (default: 3)", "3")
    .option("--timeout <ms>", "Timeout per run in ms (default: 120000)", "120000")
    .option("--json", "Output as JSON")
    .option("--debug", "Keep sandbox directories for inspection")
    .option("--model <model>", "Model to use for eval (e.g., sonnet, haiku, opus)")
    .action(async (opts) => {
      printBanner();

      // Verify Claude CLI is available
      const claudeAvailable = await checkClaudeCli();
      if (!claudeAvailable) {
        log.error("Claude CLI not found. Install it: https://docs.anthropic.com/en/docs/claude-code");
        log.info("The eval command runs Claude headless against scenarios — it requires the CLI.");
        process.exit(1);
      }

      // Load scenarios
      log.step("Loading eval scenarios...");
      const scenarios = await loadScenarios({
        suite: opts.suite,
        customPath: opts.scenarios,
      });

      if (scenarios.length === 0) {
        log.warn("No matching scenarios found.");
        if (opts.suite) {
          log.info(`Check that the suite "${opts.suite}" exists in the scenarios directory.`);
        }
        return;
      }

      log.success(`Loaded ${scenarios.length} scenario(s)`);
      log.blank();

      const runs = parseInt(opts.runs, 10);
      const timeout = parseInt(opts.timeout, 10);

      // Run scenarios
      const results: EvalRunResult[] = [];

      for (const scenario of scenarios) {
        const spinner = ora({
          text: `Running: ${scenario.name} (${runs} run${runs > 1 ? "s" : ""})`,
          prefixText: "  ",
        }).start();

        try {
          const result = await runScenarioWithRetries(
            { ...scenario, runs },
            { projectRoot: opts.path, timeout, debug: opts.debug, model: opts.model },
          );
          results.push(result);

          if (result.passed) {
            spinner.succeed(`${scenario.name}  ${result.score}/${result.maxScore}`);
          } else {
            spinner.fail(`${scenario.name}  ${result.score}/${result.maxScore}`);
          }
        } catch (error: unknown) {
          spinner.fail(`${scenario.name}  ERROR`);
          const msg = error instanceof Error ? error.message : String(error);
          log.error(`  ${msg}`);
          results.push({
            scenario: scenario.name,
            score: 0,
            maxScore: scenario.checks.reduce((s, c) => s + c.points, 0),
            passed: false,
            checks: scenario.checks.map((c) => ({ label: c.label, passed: false, points: c.points })),
          });
        }
      }

      log.blank();

      if (opts.json) {
        const overallScore = results.reduce((s, r) => s + r.score, 0);
        const overallMax = results.reduce((s, r) => s + r.maxScore, 0);
        console.log(JSON.stringify({
          results,
          overallScore,
          overallMax,
          passed: overallScore >= overallMax * 0.8,
          timestamp: new Date().toISOString(),
        }, null, 2));
        return;
      }

      renderEvalReport(results);
    });
}

function renderEvalReport(results: ReadonlyArray<EvalRunResult>): void {
  for (const result of results) {
    const icon = result.passed ? chalk.green("✓") : chalk.red("✗");
    const status = result.passed ? chalk.green("PASS") : chalk.red("FAIL");
    const score = `${result.score}/${result.maxScore}`;

    console.log(`  ${icon} ${chalk.bold(result.scenario)}  ${score}  ${status}`);

    const failedChecks = result.checks.filter((c) => !c.passed);
    for (const check of failedChecks) {
      console.log(`    ${chalk.red("✗")} ${chalk.dim(check.label)}`);
    }
  }

  log.blank();

  const totalScore = results.reduce((s, r) => s + r.score, 0);
  const totalMax = results.reduce((s, r) => s + r.maxScore, 0);
  const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  printScoreCard("Config Eval Score", pct);
  log.blank();

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  if (failed === 0) {
    log.success(`All ${passed} scenario(s) passed.`);
  } else {
    log.warn(`${passed} passed, ${failed} failed out of ${results.length} scenario(s).`);
  }
}

async function checkClaudeCli(): Promise<boolean> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);

  try {
    await exec("claude", ["--version"]);
    return true;
  } catch {
    return false;
  }
}
