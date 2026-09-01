import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EvalScenario } from "../../../types/index.js";
import {
  copyDirIfExists,
  copyIfExists,
  copyJsonWithoutSecrets,
} from "../sandbox.js";
import type {
  EvalRuntime,
  RuntimeMetadata,
  RuntimeRunOptions,
  RuntimeTranscript,
} from "../runtime.js";
import { normalizeCursorRaw, normalizeCursorSdkEvent } from "../transcript.js";

const exec = promisify(execFile);

class CursorNoFallbackError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), {
      cause: cause instanceof Error ? cause : undefined,
    });
    this.name = "CursorNoFallbackError";
  }
}

export const cursorEvalRuntime: EvalRuntime = {
  id: "cursor",
  async isAvailable() {
    try {
      await import("@cursor/sdk");
      await rememberAgentVersion();
      return true;
    } catch {
      return cursorCliExists();
    }
  },
  prepareSandbox: copyCursorProjectConfig,
  run: runCursor,
};

async function runCursor(
  options: RuntimeRunOptions,
): Promise<RuntimeTranscript> {
  try {
    return await runCursorSdk(options);
  } catch (error) {
    if (!canFallbackToCli(error)) throw error;
    return runCursorCli(options);
  }
}

async function runCursorSdk(
  options: RuntimeRunOptions,
): Promise<RuntimeTranscript> {
  if (!process.env.CURSOR_API_KEY) {
    throw new Error("SDK unavailable");
  }
  const sdk = await import("@cursor/sdk");
  const agent = await sdk.Agent.create({
    apiKey: process.env.CURSOR_API_KEY,
    ...(options.model ? { model: { id: options.model } } : {}),
    local: {
      cwd: options.cwd,
      settingSources: ["project"],
      sandboxOptions: { enabled: true },
    },
  });
  try {
    return await collectSdkTranscript(agent, options);
  } finally {
    await agent[Symbol.asyncDispose]();
  }
}

async function collectSdkTranscript(
  agent: SdkAgentHandle,
  options: RuntimeRunOptions,
): Promise<RuntimeTranscript> {
  let started = false;
  try {
    started = true;
    const run = await agent.send(options.prompt);
    const rawLines = await readSdkStream(run, options.timeout);
    const result = await run.wait();
    if (result.status !== "finished") {
      throw new CursorNoFallbackError(
        `Cursor run ended with status ${result.status}`,
      );
    }
    return {
      raw: rawLines.join("\n"),
      events: rawLines.flatMap((line) =>
        normalizeCursorSdkEvent(safeParse(line)),
      ),
      metadata: cursorMetadata("sdk-local", options.model),
    };
  } catch (error) {
    if (started) throw new CursorNoFallbackError(error);
    throw error;
  }
}

async function readSdkStream(
  run: SdkRunHandle,
  timeout: number,
): Promise<string[]> {
  const timeoutId = setTimeout(() => {
    void run.cancel();
  }, timeout);
  const rawLines: string[] = [];
  try {
    for await (const event of run.stream()) {
      rawLines.push(JSON.stringify(event));
    }
    return rawLines;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runCursorCli(
  options: RuntimeRunOptions,
): Promise<RuntimeTranscript> {
  const args = cursorCliArgs(options);
  try {
    const { stdout } = await exec("agent", args, {
      cwd: options.cwd,
      timeout: options.timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    return {
      raw: stdout,
      events: normalizeCursorRaw(stdout),
      metadata: cursorMetadata("cli-local", options.model),
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "stdout" in error) {
      const raw = String((error as { stdout: unknown }).stdout ?? "");
      return {
        raw,
        events: normalizeCursorRaw(raw),
        metadata: cursorMetadata("cli-local", options.model),
      };
    }
    throw error;
  }
}

function cursorCliArgs(options: RuntimeRunOptions): string[] {
  const args = ["-p", "--trust", "--output-format", "stream-json"];
  if (options.model) args.push("--model", options.model);
  args.push(options.prompt);
  return args;
}

function cursorMetadata(
  runtime: RuntimeMetadata["runtime"],
  model?: string,
): RuntimeMetadata {
  return {
    harness: "cursor",
    runtime,
    productVersion: cachedAgentVersion ?? "unknown",
    model: model ?? "default",
    configSources: ["project"],
  };
}

let cachedAgentVersion: string | undefined;

async function rememberAgentVersion(): Promise<void> {
  if (cachedAgentVersion) return;
  try {
    const { stdout } = await exec("agent", ["--version"], { timeout: 5_000 });
    cachedAgentVersion = stdout.trim() || "unknown";
  } catch {
    cachedAgentVersion = "unknown";
  }
}

async function cursorCliExists(): Promise<boolean> {
  try {
    const { stdout } = await exec("agent", ["--version"], { timeout: 5_000 });
    cachedAgentVersion = stdout.trim() || "unknown";
    return true;
  } catch {
    return false;
  }
}

function canFallbackToCli(error: unknown): boolean {
  if (error instanceof CursorNoFallbackError) return false;
  return !isAuthOrConfigError(error);
}

function isAuthOrConfigError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  if (name === "AuthenticationError" || name === "ConfigurationError") {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /auth|unauthorized|api.?key|not authenticated|configuration/i.test(
    message,
  );
}

function safeParse(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return line;
  }
}

async function copyCursorProjectConfig(
  sandboxDir: string,
  projectRoot: string,
  _scenario: EvalScenario,
): Promise<void> {
  await copyIfExists(
    join(projectRoot, "AGENTS.md"),
    join(sandboxDir, "AGENTS.md"),
  );
  await copyIfExists(
    join(projectRoot, ".cursorignore"),
    join(sandboxDir, ".cursorignore"),
  );
  await copyIfExists(
    join(projectRoot, ".cursor", "hooks.json"),
    join(sandboxDir, ".cursor", "hooks.json"),
  );
  await copyIfExists(
    join(projectRoot, ".cursor", "sandbox.json"),
    join(sandboxDir, ".cursor", "sandbox.json"),
  );
  await copyJsonWithoutSecrets(
    join(projectRoot, ".cursor", "mcp.json"),
    join(sandboxDir, ".cursor", "mcp.json"),
  );
  for (const dir of ["hooks", "rules", "skills", "agents"] as const) {
    await copyDirIfExists(
      join(projectRoot, ".cursor", dir),
      join(sandboxDir, ".cursor", dir),
    );
  }
}

interface SdkAgentHandle {
  send(message: string): Promise<SdkRunHandle>;
  [Symbol.asyncDispose](): Promise<void>;
}

interface SdkRunHandle {
  stream(): AsyncIterable<unknown>;
  wait(): Promise<{ status: string }>;
  cancel(): Promise<void>;
}
