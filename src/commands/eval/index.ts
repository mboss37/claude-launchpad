import { Command } from "commander";
import { select } from "@inquirer/prompts";
import ora from "ora";
import { printBanner, log } from "../../lib/output.js";
import { detectHarnesses } from "../../harness/registry.js";
import { loadScenarios, resolveRuns } from "./loader.js";
import { runScenarioWithRetries } from "./runner.js";
import { renderEvalReport, saveEvalReport } from "./report.js";
import {
  buildEvalJsonReport,
  defaultRuntimeMetadata,
  evalRuntimeFor,
  listCursorModelChoices,
  metadataFromResults,
  parseEvalHarness,
  resolveEvalHarness,
  scenarioSupportsHarness,
  skippedEvalResult,
} from "./select.js";
import type { EvalRunResult } from "../../types/index.js";
import type { HarnessId } from "../../harness/types.js";

export function createEvalCommand(): Command {
  return new Command("eval")
    .description("Test your coding agent config against eval scenarios")
    .option(
      "-s, --suite <suite>",
      "Eval suite to run (e.g., security, conventions, workflow)",
    )
    .option("-p, --path <path>", "Project root path", process.cwd())
    .option("--scenarios <path>", "Custom scenarios directory")
    .option("--runs <n>", "Runs per scenario (default: 3)", "3")
    .option(
      "--timeout <ms>",
      "Timeout per run in ms (default: 120000)",
      "120000",
    )
    .option("--json", "Output as JSON")
    .option("--debug", "Keep sandbox directories for inspection")
    .option(
      "--model <model>",
      "Model to use for eval (e.g., sonnet, haiku, opus, auto)",
    )
    .option("--harness <harness>", "Target harness: claude or cursor")
    .action(async (opts, command) => {
      printBanner();
      let userChoseRuns = command.getOptionValueSource("runs") === "cli";
      const harness = await resolveHarnessOrExit(opts);
      const runtime = evalRuntimeFor(harness);
      if (!(await runtime.isAvailable())) {
        log.error(
          harness === "cursor"
            ? "Cursor Agent is not available. Install the Cursor CLI or @cursor/sdk."
            : "Claude CLI not found. Install it: https://docs.anthropic.com/en/docs/claude-code",
        );
        process.exit(1);
      }

      if (!hasEvalFlags(opts)) {
        await promptEvalOptions(opts);
        userChoseRuns = true;
      } else if (harness === "cursor" && !opts.model) {
        opts.model = "auto";
      }

      log.step("Loading eval scenarios...");
      const scenarios = await loadScenarios({
        suite: opts.suite,
        customPath: opts.scenarios,
      });
      if (scenarios.length === 0) {
        log.warn("No matching scenarios found.");
        return;
      }
      log.success(`Loaded ${scenarios.length} scenario(s)`);
      if (opts.model) log.info(`Model: ${opts.model}`);
      log.info(`Harness: ${harness}`);
      log.blank();

      const cliRuns = parseInt(opts.runs, 10);
      const timeout = parseInt(opts.timeout, 10);
      const results = await runLoadedScenarios(scenarios, {
        harness,
        runtime,
        projectRoot: opts.path,
        timeout,
        debug: opts.debug,
        model: opts.model,
        cliRuns,
        userChoseRuns,
      });

      const metadata = metadataFromResults(
        results,
        defaultRuntimeMetadata(harness, opts.model),
      );
      if (opts.json) {
        console.log(
          JSON.stringify(
            buildEvalJsonReport(results, metadata, cliRuns),
            null,
            2,
          ),
        );
        return;
      }
      renderEvalReport(results);
      await saveEvalReport(results, opts.path, metadata, opts.suite);
    });
}

function hasEvalFlags(opts: {
  suite?: string;
  model?: string;
  runs: string;
  timeout: string;
  path: string;
  scenarios?: string;
  json?: boolean;
  debug?: boolean;
  harness?: string;
}): boolean {
  return Boolean(
    opts.suite ||
    opts.model ||
    opts.harness ||
    opts.runs !== "3" ||
    opts.timeout !== "120000" ||
    opts.path !== process.cwd() ||
    opts.scenarios ||
    opts.json ||
    opts.debug,
  );
}

async function resolveHarnessOrExit(opts: {
  path: string;
  harness?: string;
}): Promise<HarnessId> {
  try {
    const detected = await detectHarnesses(opts.path);
    return resolveEvalHarness(
      opts.harness ? parseEvalHarness(String(opts.harness)) : undefined,
      detected,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    process.exit(1);
  }
}

async function promptEvalOptions(opts: {
  suite?: string;
  runs: string;
  model?: string;
  path: string;
}): Promise<void> {
  const allScenarios = await loadScenarios({});
  const suiteCounts = new Map<string, number>();
  for (const scenario of allScenarios) {
    const suiteName = scenario.name.split("/")[0] ?? "misc";
    suiteCounts.set(suiteName, (suiteCounts.get(suiteName) ?? 0) + 1);
  }
  opts.suite = await select({
    message: "Suite",
    choices: [
      ...[...suiteCounts.entries()].map(([suiteName, count]) => ({
        name: `${suiteName} (${count} scenario${count === 1 ? "" : "s"})`,
        value: suiteName,
      })),
      { name: `all (${allScenarios.length} scenarios)`, value: undefined },
    ],
  });
  opts.runs = await select({
    message: "Runs per scenario",
    choices: [
      { name: "1 — fast", value: "1" },
      { name: "3 — default", value: "3" },
      { name: "5 — thorough", value: "5" },
    ],
  });
  const detected = await detectHarnesses(opts.path);
  const harness = resolveEvalHarness(undefined, detected);
  opts.model = await select({
    message: "Model",
    choices:
      harness === "cursor"
        ? await listCursorModelChoices()
        : [
            { name: "haiku — cheapest", value: "haiku" },
            { name: "sonnet — balanced", value: "sonnet" },
            { name: "opus — best", value: "opus" },
          ],
  });
  log.blank();
}

async function runLoadedScenarios(
  scenarios: ReadonlyArray<Awaited<ReturnType<typeof loadScenarios>>[number]>,
  options: {
    readonly harness: HarnessId;
    readonly runtime: ReturnType<typeof evalRuntimeFor>;
    readonly projectRoot: string;
    readonly timeout: number;
    readonly debug?: boolean;
    readonly model?: string;
    readonly cliRuns: number;
    readonly userChoseRuns: boolean;
  },
): Promise<EvalRunResult[]> {
  const results: EvalRunResult[] = [];
  for (const scenario of scenarios) {
    if (!scenarioSupportsHarness(scenario, options.harness)) {
      const skipped = skippedEvalResult(scenario.name, options.harness);
      results.push(skipped);
      log.warn(`${scenario.name}  SKIP  ${skipped.skipReason}`);
      continue;
    }
    const runs = resolveRuns(
      scenario.runs,
      options.cliRuns,
      options.userChoseRuns,
    );
    const spinner = ora({
      text: `Running: ${scenario.name} (${runs} run${runs > 1 ? "s" : ""})`,
      prefixText: "  ",
    }).start();
    try {
      const result = await runScenarioWithRetries(
        { ...scenario, runs },
        {
          projectRoot: options.projectRoot,
          timeout: options.timeout,
          debug: options.debug,
          model: options.model,
          runtime: options.runtime,
        },
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
        maxScore: scenario.checks.reduce((sum, check) => sum + check.points, 0),
        passed: false,
        checks: scenario.checks.map((check) => ({
          label: check.label,
          passed: false,
          points: check.points,
        })),
      });
    }
  }
  return results;
}
