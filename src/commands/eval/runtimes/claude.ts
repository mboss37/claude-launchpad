import { mkdir, writeFile, cp } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EvalScenario } from "../../../types/index.js";
import { fileExists } from "../../../lib/fs-utils.js";
import type {
  EvalRuntime,
  RuntimeMetadata,
  RuntimeRunOptions,
  RuntimeTranscript,
} from "../runtime.js";
import { normalizeClaudeRaw } from "../transcript.js";

const exec = promisify(execFile);

const ALLOWED_TOOLS = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
] as const;

export const claudeEvalRuntime: EvalRuntime = {
  id: "claude",
  async isAvailable() {
    try {
      await import("@anthropic-ai/claude-agent-sdk");
      return true;
    } catch {
      return claudeCliExists();
    }
  },
  prepareSandbox: copyClaudeProjectConfig,
  run: runClaude,
};

async function runClaude(
  options: RuntimeRunOptions,
): Promise<RuntimeTranscript> {
  try {
    const raw = await runClaudeSdk(options);
    return {
      raw,
      events: normalizeClaudeRaw(raw),
      metadata: claudeMetadata("sdk-local", options.model),
    };
  } catch {
    const raw = await runClaudeCli(options);
    return {
      raw,
      events: normalizeClaudeRaw(raw),
      metadata: claudeMetadata("cli-local", options.model),
    };
  }
}

async function runClaudeSdk(options: RuntimeRunOptions): Promise<string> {
  const sdk = await import("@anthropic-ai/claude-agent-sdk");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);
  const lines: string[] = [];
  try {
    for await (const message of sdk.query({
      prompt: options.prompt,
      options: {
        cwd: options.cwd,
        allowedTools: [...ALLOWED_TOOLS],
        permissionMode: "dontAsk",
        settingSources: ["project"],
        maxTurns: 20,
        abortController: controller,
        ...(options.model ? { model: options.model } : {}),
      },
    })) {
      lines.push(JSON.stringify(message));
    }
  } finally {
    clearTimeout(timeoutId);
  }
  return lines.join("\n");
}

async function runClaudeCli(options: RuntimeRunOptions): Promise<string> {
  const args = [
    "-p",
    options.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--max-turns",
    "20",
    "--dangerously-skip-permissions",
    "--allowedTools",
    ...ALLOWED_TOOLS,
  ];
  if (options.model) args.push("--model", options.model);
  try {
    const { stdout } = await exec("claude", args, {
      cwd: options.cwd,
      timeout: options.timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "stdout" in error) {
      return String((error as { stdout: unknown }).stdout ?? "");
    }
    throw error;
  }
}

function claudeMetadata(
  runtime: RuntimeMetadata["runtime"],
  model?: string,
): RuntimeMetadata {
  return {
    harness: "claude",
    runtime,
    productVersion: "unknown",
    model: model ?? "default",
    configSources: ["project"],
  };
}

async function claudeCliExists(): Promise<boolean> {
  try {
    await exec("claude", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

async function copyClaudeProjectConfig(
  sandboxDir: string,
  projectRoot: string,
  scenario: EvalScenario,
): Promise<void> {
  const claudeDir = join(projectRoot, ".claude");
  const sandboxClaudeDir = join(sandboxDir, ".claude");
  const settingsPath = join(claudeDir, "settings.json");
  if (await fileExists(settingsPath)) {
    await mkdir(sandboxClaudeDir, { recursive: true });
    await cp(settingsPath, join(sandboxClaudeDir, "settings.json"));
  }
  const rulesDir = join(claudeDir, "rules");
  if (await fileExists(rulesDir)) {
    await cp(rulesDir, join(sandboxClaudeDir, "rules"), { recursive: true });
  }
  const ignorePath = join(projectRoot, ".claudeignore");
  if (await fileExists(ignorePath)) {
    await cp(ignorePath, join(sandboxDir, ".claudeignore"));
  }
  if (scenario.setup.instructions) {
    await writeFile(
      join(sandboxDir, "CLAUDE.md"),
      `# Eval Scenario\n\n${scenario.setup.instructions}\n`,
    );
  }
}
