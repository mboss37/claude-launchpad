import { mkdir, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EvalScenario, EvalRunResult } from "../../types/index.js";
import type { RuntimeTranscript } from "./runtime.js";
import { evaluateChecks, makeClaudeJudge } from "./checks.js";
import { claudeEvalRuntime } from "./runtimes/claude.js";
import { normalizeClaudeRaw, serializeCanonicalEvents } from "./transcript.js";

const exec = promisify(execFile);

interface RunOptions {
  readonly projectRoot: string;
  readonly timeout: number;
  readonly debug?: boolean;
  readonly model?: string;
}

/**
 * Execute a single eval scenario run using the Agent SDK.
 *
 * 1. Create a temp directory with the scenario's seed files
 * 2. Write a minimal CLAUDE.md with the scenario's instructions
 * 3. Run Claude via Agent SDK with explicit tool permissions
 * 4. Check the results (files + captured transcript) against the scenario's checks
 * 5. Clean up
 */
export async function runScenario(
  scenario: EvalScenario,
  options: RunOptions,
): Promise<EvalRunResult> {
  const sandboxDir = join(tmpdir(), `claude-eval-${randomUUID()}`);

  try {
    await setupSandbox(sandboxDir, scenario, options.projectRoot);
    const transcript = await claudeEvalRuntime.run({
      cwd: sandboxDir,
      prompt: scenario.prompt,
      timeout: options.timeout,
      model: options.model,
    });
    return await scoreResults(scenario, sandboxDir, transcript, options.model);
  } finally {
    if (options.debug) {
      console.log(`  DEBUG: Sandbox preserved at ${sandboxDir}`);
    } else {
      await rm(sandboxDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Run a scenario multiple times and return the median result.
 */
export async function runScenarioWithRetries(
  scenario: EvalScenario,
  options: RunOptions,
): Promise<EvalRunResult> {
  const results: EvalRunResult[] = [];

  for (let i = 0; i < scenario.runs; i++) {
    const result = await runScenario(scenario, options);
    results.push(result);
  }

  const sorted = [...results].sort((a, b) => a.score - b.score);
  return sorted[Math.floor(sorted.length / 2)];
}

async function setupSandbox(
  sandboxDir: string,
  scenario: EvalScenario,
  projectRoot: string,
): Promise<void> {
  await mkdir(sandboxDir, { recursive: true });
  for (const file of scenario.setup.files) {
    const filePath = join(sandboxDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content);
  }
  await claudeEvalRuntime.prepareSandbox(sandboxDir, projectRoot, scenario);
  await exec("git", ["init", "-q"], { cwd: sandboxDir });
  await exec("git", ["add", "-A"], { cwd: sandboxDir });
  await exec(
    "git",
    [
      "-c",
      "user.name=eval",
      "-c",
      "user.email=eval@test",
      "commit",
      "-q",
      "-m",
      "eval setup",
    ],
    { cwd: sandboxDir },
  );
}

async function scoreResults(
  scenario: EvalScenario,
  sandboxDir: string,
  transcript: RuntimeTranscript,
  model?: string,
): Promise<EvalRunResult> {
  const canonical =
    transcript.events.length > 0
      ? serializeCanonicalEvents(transcript.events)
      : serializeCanonicalEvents(normalizeClaudeRaw(transcript.raw));
  const checkResults = await evaluateChecks(scenario.checks, sandboxDir, {
    transcript: canonical,
    rawTranscript: transcript.raw,
    judge: makeClaudeJudge(model),
  });

  const score = checkResults
    .filter((c) => c.passed)
    .reduce((sum, c) => sum + c.points, 0);

  const maxScore = scenario.checks.reduce((sum, c) => sum + c.points, 0);

  return {
    scenario: scenario.name,
    score,
    maxScore,
    passed: score >= scenario.passingScore,
    checks: checkResults,
  };
}
