import { mkdir, writeFile, rm, cp } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EvalScenario, EvalRunResult } from "../../types/index.js";
import { fileExists } from "../../lib/fs-utils.js";
import { evaluateChecks, makeClaudeJudge } from "./checks.js";

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
    const transcript = await runClaudeInSandbox(sandboxDir, scenario.prompt, options.timeout, options.model);
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

// ─── Sandbox Setup ───

async function setupSandbox(
  sandboxDir: string,
  scenario: EvalScenario,
  projectRoot: string,
): Promise<void> {
  await mkdir(sandboxDir, { recursive: true });

  // Write scenario seed files
  for (const file of scenario.setup.files) {
    const filePath = join(sandboxDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content);
  }

  // Copy user's full config surface into sandbox
  await copyProjectConfig(sandboxDir, projectRoot);

  // Write scenario CLAUDE.md (after config copy so it takes precedence)
  if (scenario.setup.instructions) {
    await writeFile(
      join(sandboxDir, "CLAUDE.md"),
      `# Eval Scenario\n\n${scenario.setup.instructions}\n`,
    );
  }

  await exec("git", ["init", "-q"], { cwd: sandboxDir });
  await exec("git", ["add", "-A"], { cwd: sandboxDir });
  await exec("git", [
    "-c", "user.name=eval",
    "-c", "user.email=eval@test",
    "commit", "-q", "-m", "eval setup",
  ], { cwd: sandboxDir });
}

/**
 * Copy the user's .claude/ config (settings, rules, hooks) and .claudeignore
 * into the sandbox so eval tests the full configuration surface.
 */
async function copyProjectConfig(sandboxDir: string, projectRoot: string): Promise<void> {
  const claudeDir = join(projectRoot, ".claude");
  const sandboxClaudeDir = join(sandboxDir, ".claude");

  // Copy .claude/settings.json (hooks, permissions, schema)
  const settingsPath = join(claudeDir, "settings.json");
  if (await fileExists(settingsPath)) {
    await mkdir(sandboxClaudeDir, { recursive: true });
    await cp(settingsPath, join(sandboxClaudeDir, "settings.json"));
  }

  // Copy .claude/rules/ (all convention and path-scoped rule files)
  const rulesDir = join(claudeDir, "rules");
  if (await fileExists(rulesDir)) {
    await cp(rulesDir, join(sandboxClaudeDir, "rules"), { recursive: true });
  }

  // Copy .claudeignore
  const ignorePath = join(projectRoot, ".claudeignore");
  if (await fileExists(ignorePath)) {
    await cp(ignorePath, join(sandboxDir, ".claudeignore"));
  }
}

// ─── Claude Execution ───

/**
 * Run Claude in the sandbox and return the session transcript — one JSON line
 * per message (SDK) or the CLI's stream-json output. Transcript checks assert
 * on behavior (hooks firing, tools used) that final files alone can't prove.
 */
async function runClaudeInSandbox(
  cwd: string,
  prompt: string,
  timeout: number,
  model?: string,
): Promise<string> {
  // Try Agent SDK first, fall back to CLI subprocess
  try {
    const sdk = await import("@anthropic-ai/claude-agent-sdk");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const lines: string[] = [];

    try {
      for await (const message of sdk.query({
        prompt,
        options: {
          cwd,
          allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
          permissionMode: "dontAsk",
          settingSources: [],
          maxTurns: 20,
          abortController: controller,
          ...(model ? { model } : {}),
        },
      })) {
        lines.push(JSON.stringify(message));
      }
    } finally {
      clearTimeout(timeoutId);
    }
    return lines.join("\n");
  } catch {
    // SDK not available or failed — fall back to CLI
    return runClaudeCli(cwd, prompt, timeout, model);
  }
}

async function runClaudeCli(
  cwd: string,
  prompt: string,
  timeout: number,
  model?: string,
): Promise<string> {
  try {
    const args = [
      "-p", prompt,
      "--output-format", "stream-json",
      "--verbose",
      "--max-turns", "20",
      "--dangerously-skip-permissions",
      "--allowedTools", "Bash", "Read", "Write", "Edit", "Glob", "Grep",
    ];
    if (model) args.push("--model", model);
    const { stdout } = await exec("claude", args, { cwd, timeout, maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  } catch (error: unknown) {
    // Claude might exit non-zero but still produce usable output
    if (error && typeof error === "object" && "stdout" in error) {
      return String((error as { stdout: unknown }).stdout ?? "");
    }
    throw error;
  }
}

// ─── Scoring ───

async function scoreResults(
  scenario: EvalScenario,
  sandboxDir: string,
  transcript: string,
  model?: string,
): Promise<EvalRunResult> {
  const checkResults = await evaluateChecks(scenario.checks, sandboxDir, {
    transcript,
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
