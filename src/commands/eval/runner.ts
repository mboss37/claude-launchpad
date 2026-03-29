import { mkdir, writeFile, readFile, readdir, rm, cp, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EvalScenario, EvalRunResult, EvalCheck } from "../../types/index.js";

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
 * 4. Check the results against the scenario's checks
 * 5. Clean up
 */
export async function runScenario(
  scenario: EvalScenario,
  options: RunOptions,
): Promise<EvalRunResult> {
  const sandboxDir = join(tmpdir(), `claude-eval-${randomUUID()}`);

  try {
    await setupSandbox(sandboxDir, scenario, options.projectRoot);
    await runClaudeInSandbox(sandboxDir, scenario.prompt, options.timeout, options.model);
    return await scoreResults(scenario, sandboxDir);
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
  if (await fileExistsSafe(settingsPath)) {
    await mkdir(sandboxClaudeDir, { recursive: true });
    await cp(settingsPath, join(sandboxClaudeDir, "settings.json"));
  }

  // Copy .claude/rules/ (all convention and path-scoped rule files)
  const rulesDir = join(claudeDir, "rules");
  if (await fileExistsSafe(rulesDir)) {
    await cp(rulesDir, join(sandboxClaudeDir, "rules"), { recursive: true });
  }

  // Copy .claudeignore
  const ignorePath = join(projectRoot, ".claudeignore");
  if (await fileExistsSafe(ignorePath)) {
    await cp(ignorePath, join(sandboxDir, ".claudeignore"));
  }
}

async function fileExistsSafe(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ─── Claude Execution ───

async function runClaudeInSandbox(
  cwd: string,
  prompt: string,
  timeout: number,
  model?: string,
): Promise<void> {
  // Try Agent SDK first, fall back to CLI subprocess
  try {
    const sdk = await import("@anthropic-ai/claude-agent-sdk");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      for await (const _message of sdk.query({
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
        // Consume the stream — we only care about side effects (file edits)
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    // SDK not available or failed — fall back to CLI
    await runClaudeCli(cwd, prompt, timeout, model);
  }
}

async function runClaudeCli(
  cwd: string,
  prompt: string,
  timeout: number,
  model?: string,
): Promise<void> {
  try {
    const args = [
      "-p", prompt,
      "--output-format", "text",
      "--max-turns", "20",
      "--dangerously-skip-permissions",
      "--allowedTools", "Bash", "Read", "Write", "Edit", "Glob", "Grep",
    ];
    if (model) args.push("--model", model);
    await exec("claude", args, { cwd, timeout, maxBuffer: 10 * 1024 * 1024 });
  } catch (error: unknown) {
    // Claude might exit non-zero but still produce usable output
    if (error && typeof error === "object" && "stdout" in error) {
      return; // Files may have been modified despite exit code
    }
    throw error;
  }
}

// ─── Scoring ───

async function scoreResults(
  scenario: EvalScenario,
  sandboxDir: string,
): Promise<EvalRunResult> {
  const checkResults = await evaluateChecks(scenario.checks, sandboxDir);

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

async function evaluateChecks(
  checks: ReadonlyArray<EvalCheck>,
  sandboxDir: string,
): Promise<ReadonlyArray<{ label: string; passed: boolean; points: number }>> {
  const results: { label: string; passed: boolean; points: number }[] = [];

  for (const check of checks) {
    const passed = await evaluateSingleCheck(check, sandboxDir);
    results.push({ label: check.label, passed, points: check.points });
  }

  return results;
}

async function evaluateSingleCheck(check: EvalCheck, sandboxDir: string): Promise<boolean> {
  switch (check.type) {
    case "grep":
      return checkGrep(check, sandboxDir);
    case "file-exists":
      return checkFileExists(check, sandboxDir);
    case "file-absent":
      return checkFileAbsent(check, sandboxDir);
    case "max-lines":
      return checkMaxLines(check, sandboxDir);
    case "custom":
      return false;
    default:
      return false;
  }
}

// ─── Individual Check Implementations ───

async function checkGrep(check: EvalCheck, sandboxDir: string): Promise<boolean> {
  if (!check.pattern) return false;
  try {
    const content = await readFile(join(sandboxDir, check.target), "utf-8");
    let found: boolean;
    try {
      found = new RegExp(check.pattern).test(content);
    } catch {
      return false; // Invalid regex
    }
    return check.expect === "present" ? found : !found;
  } catch {
    return check.expect === "absent";
  }
}

async function checkFileExists(check: EvalCheck, sandboxDir: string): Promise<boolean> {
  try {
    await readFile(join(sandboxDir, check.target));
    return check.expect === "present";
  } catch {
    return check.expect === "absent";
  }
}

async function checkFileAbsent(check: EvalCheck, sandboxDir: string): Promise<boolean> {
  try {
    await readFile(join(sandboxDir, check.target));
    return check.expect === "absent";
  } catch {
    return check.expect === "present";
  }
}

async function checkMaxLines(check: EvalCheck, sandboxDir: string): Promise<boolean> {
  const maxLines = parseInt(check.pattern ?? "800", 10);
  try {
    const files = await listAllFiles(join(sandboxDir, check.target));
    for (const file of files) {
      const content = await readFile(file, "utf-8");
      if (content.split("\n").length > maxLines) {
        return check.expect === "absent";
      }
    }
    return check.expect === "present";
  } catch {
    return check.expect === "absent";
  }
}

// ─── Utilities ───

async function listAllFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await listAllFiles(fullPath));
      } else {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return results;
}
