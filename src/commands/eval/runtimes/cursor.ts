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
    if (process.env.CURSOR_API_KEY) {
      try {
        await import("@cursor/sdk");
        await rememberAgentVersion();
        return true;
      } catch {
        return cursorCliExists();
      }
    }
    return cursorCliExists();
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
  await rememberAgentVersion();
  const deadline = Date.now() + options.timeout;
  let agent: SdkAgentHandle | undefined;
  const createPromise = sdk.Agent.create({
    apiKey: process.env.CURSOR_API_KEY,
    ...(options.model ? { model: { id: options.model } } : {}),
    local: {
      cwd: options.cwd,
      settingSources: ["project"],
      sandboxOptions: { enabled: true },
    },
  });
  try {
    agent = await withDeadline(
      createPromise,
      deadline,
      "agent creation",
      undefined,
      (late) => disposeAgent(late),
    );
    return await collectSdkTranscript(
      agent,
      options,
      deadline,
      cachedAgentVersion ?? "unknown",
    );
  } finally {
    if (agent) await disposeAgent(agent);
  }
}

async function collectSdkTranscript(
  agent: SdkAgentHandle,
  options: RuntimeRunOptions,
  deadline: number,
  productVersion: string,
): Promise<RuntimeTranscript> {
  let started = false;
  try {
    const run = await withDeadline(
      agent.send(options.prompt),
      deadline,
      "send",
      undefined,
      (late) => late.cancel(),
    );
    started = true;
    const rawLines = await readSdkStream(run, deadline);
    const result = await withDeadline(run.wait(), deadline, "wait", () =>
      run.cancel(),
    );
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
      metadata: cursorMetadata(
        "sdk-local",
        modelId(result.model),
        productVersion,
        options.model,
      ),
    };
  } catch (error) {
    if (started) throw new CursorNoFallbackError(error);
    throw error;
  }
}

async function readSdkStream(
  run: SdkRunHandle,
  deadline: number,
): Promise<string[]> {
  const rawLines: string[] = [];
  const collect = async (): Promise<string[]> => {
    for await (const event of run.stream()) {
      rawLines.push(JSON.stringify(event));
    }
    return rawLines;
  };
  return withDeadline(collect(), deadline, "stream", () => run.cancel());
}

async function runCursorCli(
  options: RuntimeRunOptions,
): Promise<RuntimeTranscript> {
  const args = cursorCliArgs(options);
  await rememberAgentVersion();
  try {
    const { stdout } = await exec("agent", args, {
      cwd: options.cwd,
      timeout: options.timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (!hasSuccessfulCliResult(stdout)) {
      throw new Error(
        "Cursor Agent CLI exited without a successful terminal result",
      );
    }
    return {
      raw: stdout,
      events: normalizeCursorRaw(stdout),
      metadata: cursorMetadata(
        "cli-local",
        cursorCliModel(stdout),
        cachedAgentVersion,
        options.model,
      ),
    };
  } catch (error) {
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
  productVersion?: string,
  requestedModel?: string,
): RuntimeMetadata {
  return {
    harness: "cursor",
    runtime,
    productVersion: productVersion ?? "unknown",
    model: model ?? "unknown",
    ...(requestedModel ? { requestedModel } : {}),
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

function hasSuccessfulCliResult(raw: string): boolean {
  return raw.split("\n").some((line) => {
    const value = safeParse(line);
    if (value === null || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return (
      record.type === "result" &&
      record.subtype === "success" &&
      record.is_error !== true
    );
  });
}

function cursorCliModel(raw: string): string | undefined {
  for (const line of raw.split("\n")) {
    const value = safeParse(line);
    if (value === null || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    if (record.type === "system" && record.subtype === "init") {
      const model = modelId(record.model);
      if (model) return model;
    }
  }
  return undefined;
}

function modelId(model: unknown): string | undefined {
  if (typeof model === "string") return model;
  if (model === null || typeof model !== "object") return undefined;
  const id = (model as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

async function withDeadline<T>(
  promise: Promise<T>,
  deadline: number,
  stage: string,
  onTimeout?: () => Promise<void>,
  onLateResolve?: (value: T) => Promise<void>,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(
      () => {
        if (onTimeout) void onTimeout().catch(() => undefined);
        reject(
          new CursorNoFallbackError(new Error(`Cursor SDK ${stage} timed out`)),
        );
      },
      Math.max(1, deadline - Date.now()),
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } catch (error) {
    if (onLateResolve) {
      void promise.then((value) => onLateResolve(value)).catch(() => undefined);
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function disposeAgent(agent: SdkAgentHandle): Promise<void> {
  const dispose = agent[Symbol.asyncDispose]().catch(() => undefined);
  await Promise.race([
    dispose,
    new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
  ]);
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
    join(projectRoot, ".cursor", "cli.json"),
    join(sandboxDir, ".cursor", "cli.json"),
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
  wait(): Promise<{ status: string; model?: unknown }>;
  cancel(): Promise<void>;
}
