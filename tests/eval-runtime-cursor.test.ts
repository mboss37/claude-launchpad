import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const { captured } = vi.hoisted(() => ({
  captured: {
    createOptions: null as Record<string, unknown> | null,
    disposed: false,
    canceled: false,
    sdkMode: "ok" as
      | "ok"
      | "unavailable"
      | "auth"
      | "send-fail"
      | "run-fail"
      | "hang-create"
      | "hang-send"
      | "hang-wait",
    resolvedModel: undefined as string | undefined,
    cliMode: "ok" as "ok" | "unavailable" | "fail" | "cancelled",
    cliArgs: null as ReadonlyArray<string> | null,
    cliFile: null as string | null,
  },
}));

vi.mock("@cursor/sdk", () => ({
  Agent: {
    create: vi.fn(async (options: Record<string, unknown>) => {
      captured.createOptions = options;
      if (captured.sdkMode === "hang-create") {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              send: async () => {
                throw new Error("late create should not send");
              },
              [Symbol.asyncDispose]: async () => {
                captured.disposed = true;
              },
            });
          }, 80);
        });
      }
      if (captured.sdkMode === "unavailable") {
        throw new Error("SDK unavailable");
      }
      if (captured.sdkMode === "auth") {
        throw new Error("Invalid API key");
      }
      return {
        send: vi.fn(async () => {
          if (captured.sdkMode === "hang-send") {
            return new Promise(() => {});
          }
          if (captured.sdkMode === "send-fail") {
            throw new Error("SDK send unavailable");
          }
          if (captured.sdkMode === "run-fail") {
            return {
              stream: async function* () {
                yield { type: "assistant", message: { content: [] } };
              },
              wait: async () => {
                throw new Error("run aborted after start");
              },
              cancel: async () => {
                captured.canceled = true;
              },
            };
          }
          return {
            stream: async function* () {
              yield {
                type: "assistant",
                message: { content: [{ type: "text", text: "ok" }] },
              };
            },
            wait: async () =>
              captured.sdkMode === "hang-wait"
                ? new Promise(() => {})
                : {
                    status: "finished",
                    model: captured.resolvedModel
                      ? { id: captured.resolvedModel }
                      : undefined,
                  },
            cancel: async () => {
              captured.canceled = true;
            },
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
          if (captured.cliMode === "unavailable") {
            const error = new Error("agent not found");
            if (typeof callback === "function") {
              callback(error, { stdout: "", stderr: "not found" });
              return new EventEmitter();
            }
          }
          if (captured.cliMode === "cancelled" && !args.includes("--version")) {
            const result = {
              stdout: [
                '{"type":"assistant","message":{"content":[{"type":"text","text":"partial"}]}}',
                '{"type":"result","subtype":"cancelled","is_error":false}',
              ].join("\n"),
              stderr: "",
            };
            if (typeof callback === "function") {
              callback(null, result);
              return new EventEmitter();
            }
            return result;
          }
          if (captured.cliMode === "fail" && !args.includes("--version")) {
            const error = Object.assign(new Error("agent failed"), {
              stdout:
                '{"type":"assistant","message":{"content":[{"type":"text","text":"partial"}]}}\n',
              stderr: "authentication failed",
            });
            if (typeof callback === "function") {
              callback(error, { stdout: error.stdout, stderr: error.stderr });
              return new EventEmitter();
            }
          }
          const result = {
            stdout: args.includes("--version")
              ? "2026.08.25-3e8eec8\n"
              : [
                  '{"type":"system","subtype":"init","model":"cursor-cli-resolved"}',
                  '{"type":"assistant","message":{"content":[{"type":"text","text":"cli"}]}}',
                  '{"type":"result","subtype":"success","is_error":false}',
                ].join("\n"),
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
  beforeEach(() => {
    delete process.env.CURSOR_API_KEY;
    captured.sdkMode = "ok";
    captured.cliMode = "ok";
    captured.cliArgs = null;
    captured.disposed = false;
    captured.canceled = false;
    captured.resolvedModel = undefined;
  });

  it("identifies as cursor and is available when the SDK loads", async () => {
    expect(cursorEvalRuntime.id).toBe("cursor");
    expect(await cursorEvalRuntime.isAvailable()).toBe(true);
  });

  it("is unavailable without SDK credentials or an Agent CLI", async () => {
    captured.cliMode = "unavailable";
    expect(await cursorEvalRuntime.isAvailable()).toBe(false);
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
    expect(transcript.metadata.model).toBe("unknown");
    expect(transcript.metadata.requestedModel).toBe("composer-2");
    expect(transcript.metadata.productVersion).toBe("2026.08.25-3e8eec8");
  });

  it("reports the model resolved by the SDK", async () => {
    process.env.CURSOR_API_KEY = "test-key";
    captured.resolvedModel = "resolved-cursor-model";
    const transcript = await cursorEvalRuntime.run({
      cwd: SANDBOX,
      prompt: "do the task",
      timeout: 5_000,
      model: "auto",
    });
    expect(transcript.metadata.model).toBe("resolved-cursor-model");
    expect(transcript.metadata.requestedModel).toBe("auto");
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
    expect(captured.cliArgs).not.toContain("--auto-review");
    expect(captured.cliArgs).not.toContain("--force");
    expect(transcript.metadata.runtime).toBe("cli-local");
    expect(transcript.metadata.model).toBe("cursor-cli-resolved");
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

  it("falls back when send fails before a run handle exists", async () => {
    process.env.CURSOR_API_KEY = "test-key";
    captured.sdkMode = "send-fail";
    captured.cliArgs = null;
    const transcript = await cursorEvalRuntime.run({
      cwd: SANDBOX,
      prompt: "do the task",
      timeout: 5_000,
      model: "composer-2",
    });
    expect(captured.cliArgs?.[0]).toBe("-p");
    expect(transcript.metadata.runtime).toBe("cli-local");
    expect(captured.disposed).toBe(true);
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

  it("rejects a cancelled CLI result instead of scoring partial stdout", async () => {
    captured.cliMode = "cancelled";
    await expect(
      cursorEvalRuntime.run({
        cwd: SANDBOX,
        prompt: "do the task",
        timeout: 5_000,
        model: "composer-2",
      }),
    ).rejects.toThrow(/successful terminal result/i);
  });

  it("rejects a non-zero Agent CLI exit instead of scoring partial stdout", async () => {
    captured.cliMode = "fail";
    await expect(
      cursorEvalRuntime.run({
        cwd: SANDBOX,
        prompt: "do the task",
        timeout: 5_000,
        model: "composer-2",
      }),
    ).rejects.toThrow(/agent failed/i);
  });

  it.each(["hang-create", "hang-send", "hang-wait"] as const)(
    "times out the complete SDK lifecycle at %s",
    async (sdkMode) => {
      process.env.CURSOR_API_KEY = "test-key";
      captured.sdkMode = sdkMode;
      await expect(
        cursorEvalRuntime.run({
          cwd: SANDBOX,
          prompt: "do the task",
          timeout: 25,
          model: "composer-2",
        }),
      ).rejects.toThrow(/timed out/i);
      expect(captured.cliArgs).toBeNull();
      if (sdkMode === "hang-create") {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      expect(captured.disposed).toBe(true);
      if (sdkMode === "hang-wait") {
        expect(captured.canceled).toBe(true);
      }
    },
  );
});
