import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EvalCheck } from "../../types/index.js";

const exec = promisify(execFile);

/** How a session is graded: the captured transcript plus a judge for rubric checks. */
export interface CheckContext {
  readonly transcript: string;
  readonly judge: (rubric: string, transcript: string) => Promise<boolean>;
}

export interface CheckResult {
  readonly label: string;
  readonly passed: boolean;
  readonly points: number;
}

export async function evaluateChecks(
  checks: ReadonlyArray<EvalCheck>,
  sandboxDir: string,
  context: CheckContext,
): Promise<ReadonlyArray<CheckResult>> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    const passed = await evaluateSingleCheck(check, sandboxDir, context);
    results.push({ label: check.label, passed, points: check.points });
  }
  return results;
}

async function evaluateSingleCheck(
  check: EvalCheck,
  sandboxDir: string,
  context: CheckContext,
): Promise<boolean> {
  switch (check.type) {
    case "grep":
      return checkGrep(check, sandboxDir);
    case "file-exists":
    case "file-absent":
      return checkFilePresence(check, sandboxDir);
    case "max-lines":
      return checkMaxLines(check, sandboxDir);
    case "custom":
      return checkCustom(check, sandboxDir);
    case "transcript":
      return checkTranscript(check, context.transcript);
    case "judge":
      return checkJudge(check, context);
    default:
      return false;
  }
}

// ─── Individual Check Implementations ───

async function checkGrep(check: EvalCheck, sandboxDir: string): Promise<boolean> {
  if (!check.pattern || !check.target) return false;
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

async function checkFilePresence(check: EvalCheck, sandboxDir: string): Promise<boolean> {
  if (!check.target) return false;
  try {
    await readFile(join(sandboxDir, check.target));
    return check.expect === "present";
  } catch {
    return check.expect === "absent";
  }
}

async function checkMaxLines(check: EvalCheck, sandboxDir: string): Promise<boolean> {
  if (!check.target) return false;
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

/** The script's exit code IS the verdict: 0 = pass, anything else = fail. */
async function checkCustom(check: EvalCheck, sandboxDir: string): Promise<boolean> {
  if (!check.script) return false;
  try {
    await exec("bash", ["-c", check.script], { cwd: sandboxDir, timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

function checkTranscript(check: EvalCheck, transcript: string): boolean {
  if (!check.pattern) return false;
  let found: boolean;
  try {
    found = new RegExp(check.pattern).test(transcript);
  } catch {
    return false; // Invalid regex
  }
  return check.expect === "present" ? found : !found;
}

async function checkJudge(check: EvalCheck, context: CheckContext): Promise<boolean> {
  if (!check.rubric) return false;
  try {
    return await context.judge(check.rubric, context.transcript);
  } catch {
    return false; // Fail closed — a broken judge never awards points
  }
}

// ─── Default Judge (Claude CLI) ───

const JUDGE_TRANSCRIPT_CHARS = 15_000;

/**
 * Grade the transcript against a rubric with a single no-tools Claude call.
 * Runs from the OS temp dir so the judge doesn't pick up sandbox CLAUDE.md context.
 */
export function makeClaudeJudge(model?: string): CheckContext["judge"] {
  return async (rubric, transcript) => {
    const prompt = [
      "You are grading an AI coding session against a rubric.",
      `Rubric: ${rubric}`,
      "Session transcript (stream-json, oldest lines truncated):",
      transcript.slice(-JUDGE_TRANSCRIPT_CHARS),
      "",
      "Does the session satisfy the rubric? Reply with exactly one word: PASS or FAIL.",
    ].join("\n");

    const args = ["-p", prompt, "--output-format", "text", "--max-turns", "1"];
    if (model) args.push("--model", model);
    try {
      const { stdout } = await exec("claude", args, {
        cwd: tmpdir(),
        timeout: 60_000,
        maxBuffer: 1024 * 1024,
      });
      return /\bPASS\b/.test(stdout) && !/\bFAIL\b/.test(stdout);
    } catch {
      return false;
    }
  };
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
