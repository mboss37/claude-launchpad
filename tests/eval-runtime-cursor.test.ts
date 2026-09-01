import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const { captured } = vi.hoisted(() => ({
  captured: {
    createOptions: null as Record<string, unknown> | null,
    disposed: false,
    sdkMode: "ok" as "ok" | "unavailable" | "auth" | "run-fail",
    cliArgs: null as ReadonlyArray<string> | null,
    cliFile: null as string | null,
  },
}));

vi.mock("@cursor/sdk", () => ({
  Agent: {
    create: vi.fn(async (options: Record<string, unknown>) => {
      captured.createOptions = options;
      if (captured.sdkMode === "unavailable") {
        throw new Error("SDK unavailable");
      }
      if (captured.sdkMode === "auth") {
        throw new Error("Invalid API key");
      }
      return {
        send: vi.fn(async () => {
          if (captured.sdkMode === "run-fail") {
            throw new Error("run aborted after start");
          }
          return {
            stream: async function* () {
              yield {
                type: "assistant",
                message: { content: [{ type: "text", text: "ok" }] },
              };
            },
            wait: async () => ({ status: "finished" }),
          };
        }),
        [Symbol.asyncDispose]: async () => {
          captured.disposed = true;
        },
      };
    }),
  },
}));

vi.mock("node:child_process", async () => {
  const actual =
    await vi.importActual<typeof import("node:child_process")>(
      "node:child_process",
    );
  return {
    ...actual,
    execFile: vi.fn(
      (
        file: string,
        args: ReadonlyArray<string>,
        _opts: unknown,
        callback?: (
          error: Error | null,
          result: { stdout: string; stderr: string },
        ) => void,
      ) => {
        if (file === "agent") {
          captured.cliFile = file;
          captured.cliArgs = args;
          const result = {
            stdout: args.includes("--version")
              ? "2026.08.25-3e8eec8\n"
              : '{"type":"assistant","message":{"content":[{"type":"text","text":"cli"}]}}\n',
            stderr: "",
          };
          if (typeof callback === "function") {
            callback(null, result);
            return new EventEmitter();
          }
          return result;
        }
        return actual.execFile(
          file,
          args as string[],
          _opts as object,
          callback as never,
        );
      },
    ),
  };
});

import { cursorEvalRuntime } from "../src/commands/eval/runtimes/cursor.js";

const SANDBOX = "/tmp/eval-cursor-sandbox";

describe("cursorEvalRuntime", () => {
  it("identifies as cursor and is available when the SDK loads", async () => {
    expect(cursorEvalRuntime.id).toBe("cursor");
    expect(await cursorEvalRuntime.isAvailable()).toBe(true);
  });

  it("creates a local project-scoped agent and disposes it", async () => {
    process.env.CURSOR_API_KEY = "test-key";
    captured.sdkMode = "ok";
    captured.createOptions = null;
    captured.disposed = false;
    const transcript = await cursorEvalRuntime.run({
      cwd: SANDBOX,
      prompt: "do the task",
      timeout: 5_000,
      model: "composer-2",
    });
    expect(captured.createOptions?.local).toMatchObject({
      cwd: SANDBOX,
      settingSources: ["project"],
    });
    expect(captured.createOptions?.model).toEqual({ id: "composer-2" });
    expect(captured.disposed).toBe(true);
    expect(transcript.raw).toContain('"type"');
    expect(transcript.metadata.harness).toBe("cursor");
    expect(transcript.metadata.runtime).toBe("sdk-local");
    expect(transcript.metadata.model).toBe("composer-2");
  });

  it("falls back to agent -p without --force when the SDK is unavailable", async () => {
    delete process.env.CURSOR_API_KEY;
    captured.sdkMode = "unavailable";
    captured.cliArgs = null;
    const transcript = await cursorEvalRuntime.run({
      cwd: SANDBOX,
      prompt: "do the task",
      timeout: 5_000,
      model: "composer-2",
    });
    expect(captured.cliFile).toBe("agent");
    expect(captured.cliArgs).toEqual([
      "-p",
      "--trust",
      "--output-format",
      "stream-json",
      "--model",
      "composer-2",
      "do the task",
    ]);
    expect(captured.cliArgs).not.toContain("--force");
    expect(transcript.metadata.runtime).toBe("cli-local");
  });

  it("does not duplicate a paid run after an authentication failure", async () => {
    process.env.CURSOR_API_KEY = "bad-key";
    captured.sdkMode = "auth";
    captured.cliArgs = null;
    await expect(
      cursorEvalRuntime.run({
        cwd: SANDBOX,
        prompt: "do the task",
        timeout: 5_000,
        model: "composer-2",
      }),
    ).rejects.toThrow(/api key/i);
    expect(captured.cliArgs).toBeNull();
  });

  it("does not fall back after the SDK run has started", async () => {
    process.env.CURSOR_API_KEY = "test-key";
    captured.sdkMode = "run-fail";
    captured.cliArgs = null;
    captured.disposed = false;
    await expect(
      cursorEvalRuntime.run({
        cwd: SANDBOX,
        prompt: "do the task",
        timeout: 5_000,
        model: "composer-2",
      }),
    ).rejects.toThrow(/after start/i);
    expect(captured.cliArgs).toBeNull();
    expect(captured.disposed).toBe(true);
  });
});
