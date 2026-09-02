import { mkdir, writeFile, rm, cp, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EvalScenario } from "../../types/index.js";
import { fileExists } from "../../lib/fs-utils.js";
import type { EvalRuntime } from "./runtime.js";

const exec = promisify(execFile);

const SECRET_KEY = /token|secret|password|authorization|apikey/;
const ENV_REFERENCE = /^\$[A-Z_][A-Z0-9_]*$|^\$\{(?:env:)?[A-Z_][A-Z0-9_]+\}$/i;

export async function createEvalSandbox(
  runtime: EvalRuntime,
  scenario: EvalScenario,
  projectRoot: string,
): Promise<string> {
  const sandboxDir = join(tmpdir(), `lp-eval-${runtime.id}-${randomUUID()}`);
  try {
    await mkdir(sandboxDir, { recursive: true });
    await writeSeedFiles(sandboxDir, scenario);
    await runtime.prepareSandbox(sandboxDir, projectRoot, scenario);
    await writeScenarioInstructions(sandboxDir, runtime.id, scenario);
    await initSandboxGit(sandboxDir);
    return sandboxDir;
  } catch (error) {
    await rm(sandboxDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

export async function copyIfExists(
  source: string,
  destination: string,
): Promise<void> {
  if (!(await fileExists(source))) return;
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination);
}

export async function copyDirIfExists(
  source: string,
  destination: string,
): Promise<void> {
  if (!(await fileExists(source))) return;
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

export async function copyJsonWithoutSecrets(
  source: string,
  destination: string,
): Promise<void> {
  if (!(await fileExists(source))) return;
  const raw = await readFile(source, "utf-8");
  assertNoLiteralSecrets(JSON.parse(raw) as unknown, source);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, raw);
}

export function assertNoLiteralSecrets(value: unknown, source: string): void {
  const key = findLiteralSecretKey(value);
  if (key) {
    throw new Error(
      `Eval sandbox refused to copy ${source}: literal value under "${key}"`,
    );
  }
}

async function writeSeedFiles(
  sandboxDir: string,
  scenario: EvalScenario,
): Promise<void> {
  for (const file of scenario.setup.files) {
    const filePath = join(sandboxDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content);
  }
}

async function writeScenarioInstructions(
  sandboxDir: string,
  harness: EvalRuntime["id"],
  scenario: EvalScenario,
): Promise<void> {
  if (!scenario.setup.instructions) return;
  const name = harness === "cursor" ? "AGENTS.md" : "CLAUDE.md";
  const path = join(sandboxDir, name);
  const existing = (await fileExists(path))
    ? await readFile(path, "utf-8")
    : "";
  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await writeFile(
    path,
    `${existing}${separator}\n# Eval Scenario\n\n${scenario.setup.instructions}\n`,
  );
}

async function initSandboxGit(sandboxDir: string): Promise<void> {
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

function findLiteralSecretKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findLiteralSecretKey(entry);
      if (found) return found;
    }
    return null;
  }
  if (value === null || typeof value !== "object") return null;
  for (const [key, entry] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (SECRET_KEY.test(normalizedKey) && isLiteralSecretValue(entry)) {
      return key;
    }
    const nested = findLiteralSecretKey(entry);
    if (nested) return nested;
  }
  return null;
}

function isLiteralSecretValue(entry: unknown): boolean {
  if (entry === null || entry === undefined) return false;
  if (typeof entry === "string") {
    return entry.length > 0 && !ENV_REFERENCE.test(entry);
  }
  return (
    typeof entry === "number" ||
    typeof entry === "boolean" ||
    typeof entry === "object"
  );
}
