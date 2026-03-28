import { mkdir, writeFile, readFile, readdir, rm, cp } from "node:fs/promises";
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
}

/**
 * Execute a single eval scenario run.
 *
 * 1. Create a temp directory with the scenario's seed files
 * 2. Copy the project's .claude/ config into it
 * 3. Write a minimal CLAUDE.md with the scenario's instructions
 * 4. Run Claude headless with the scenario prompt
 * 5. Check the results against the scenario's checks
 * 6. Clean up
 */
export async function runScenario(
  scenario: EvalScenario,
  options: RunOptions,
): Promise<EvalRunResult> {
  const sandboxDir = join(tmpdir(), `claude-eval-${randomUUID()}`);

  try {
    // 1. Set up sandbox
    await mkdir(sandboxDir, { recursive: true });

    // 2. Write seed files
    for (const file of scenario.setup.files) {
      const filePath = join(sandboxDir, file.path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content);
    }

    // 3. Copy .claude/ config from the real project
    const claudeDir = join(options.projectRoot, ".claude");
    const sandboxClaudeDir = join(sandboxDir, ".claude");
    try {
      await cp(claudeDir, sandboxClaudeDir, { recursive: true });
    } catch {
      // No .claude/ dir to copy — that's fine
    }

    // 4. Write CLAUDE.md with scenario instructions
    if (scenario.setup.instructions) {
      await writeFile(
        join(sandboxDir, "CLAUDE.md"),
        `# Eval Scenario\n\n${scenario.setup.instructions}\n`,
      );
    }

    // 5. Initialize a git repo (Claude Code expects one)
    await exec("git", ["init", "-q"], { cwd: sandboxDir });
    await exec("git", ["add", "-A"], { cwd: sandboxDir });
    await exec("git", [
      "-c", "user.name=eval",
      "-c", "user.email=eval@test",
      "commit", "-q", "-m", "eval setup",
    ], { cwd: sandboxDir });

    // 6. Run Claude headless in bare mode (no hooks/plugins — test raw CLAUDE.md compliance)
    await runClaude(sandboxDir, scenario.prompt, options.timeout);

    // 7. Check results
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

// ─── Claude Execution ───

async function runClaude(
  cwd: string,
  prompt: string,
  timeout: number,
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await exec(
      "claude",
      [
        "-p", prompt,
        "--output-format", "text",
        "--max-turns", "20",
        "--dangerously-skip-permissions",
        "--allowedTools", "Read", "Write", "Edit", "Bash", "Glob", "Grep",
      ],
      {
        cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
  } catch (error: unknown) {
    // Claude might exit non-zero but still produce usable output
    if (error && typeof error === "object" && "stdout" in error) {
      return {
        stdout: String((error as Record<string, unknown>).stdout ?? ""),
        stderr: String((error as Record<string, unknown>).stderr ?? ""),
      };
    }
    throw error;
  }
}

// ─── Check Evaluation ───

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
    case "grep": {
      if (!check.pattern) return false;
      try {
        const content = await readFile(join(sandboxDir, check.target), "utf-8");
        let found: boolean;
        try {
          found = new RegExp(check.pattern).test(content);
        } catch {
          return false; // Invalid regex pattern
        }
        return check.expect === "present" ? found : !found;
      } catch {
        return check.expect === "absent";
      }
    }

    case "file-exists": {
      try {
        await readFile(join(sandboxDir, check.target));
        return check.expect === "present";
      } catch {
        return check.expect === "absent";
      }
    }

    case "file-absent": {
      try {
        await readFile(join(sandboxDir, check.target));
        return check.expect === "absent";
      } catch {
        return check.expect === "present";
      }
    }

    case "max-lines": {
      // Check that no file in the target directory exceeds the line count in `pattern`
      const maxLines = parseInt(check.pattern ?? "800", 10);
      try {
        const files = await listAllFiles(join(sandboxDir, check.target));
        for (const file of files) {
          const content = await readFile(file, "utf-8");
          const lineCount = content.split("\n").length;
          if (lineCount > maxLines) {
            return check.expect === "absent"; // File exceeds limit = violation present
          }
        }
        return check.expect === "present"; // No file exceeds limit = no violation
      } catch {
        return check.expect === "absent";
      }
    }

    case "custom":
      return false;

    default:
      return false;
  }
}

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
