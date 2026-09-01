import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

const { captured } = vi.hoisted(() => ({
  captured: {
    sdkOptions: null as Record<string, unknown> | null,
    sdkShouldFail: false,
    cliArgs: null as ReadonlyArray<string> | null,
  },
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(async function* (args: { options: Record<string, unknown> }) {
    if (captured.sdkShouldFail) {
      throw new Error("SDK unavailable");
    }
    captured.sdkOptions = args.options;
    yield { type: "assistant", message: { content: "ok" } };
  }),
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
        if (file === "claude") {
          captured.cliArgs = args;
          const result = { stdout: '{"type":"result"}\n', stderr: "" };
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

import { claudeEvalRuntime } from "../src/commands/eval/runtimes/claude.js";

describe("claudeEvalRuntime", () => {
  it("identifies as claude and is available when the SDK loads", async () => {
    expect(claudeEvalRuntime.id).toBe("claude");
    expect(await claudeEvalRuntime.isAvailable()).toBe(true);
  });

  it("loads the sandbox project config through the SDK", async () => {
    captured.sdkShouldFail = false;
    captured.sdkOptions = null;
    const transcript = await claudeEvalRuntime.run({
      cwd: "/tmp/eval-sandbox",
      prompt: "do the task",
      timeout: 5_000,
    });
    expect(captured.sdkOptions?.settingSources).toEqual(["project"]);
    expect(captured.sdkOptions?.allowedTools).toEqual([
      "Bash",
      "Read",
      "Write",
      "Edit",
      "Glob",
      "Grep",
    ]);
    expect(transcript.raw).toContain('"type"');
    expect(transcript.metadata.harness).toBe("claude");
    expect(transcript.metadata.runtime).toBe("sdk-local");
  });

  it("falls back to claude -p with the current argument list when the SDK fails", async () => {
    captured.sdkShouldFail = true;
    captured.cliArgs = null;
    const transcript = await claudeEvalRuntime.run({
      cwd: "/tmp/eval-sandbox",
      prompt: "do the task",
      timeout: 5_000,
      model: "haiku",
    });
    expect(captured.cliArgs).toEqual([
      "-p",
      "do the task",
      "--output-format",
      "stream-json",
      "--verbose",
      "--max-turns",
      "20",
      "--dangerously-skip-permissions",
      "--allowedTools",
      "Bash",
      "Read",
      "Write",
      "Edit",
      "Glob",
      "Grep",
      "--model",
      "haiku",
    ]);
    expect(transcript.raw).toContain('"type"');
    expect(transcript.metadata.runtime).toBe("cli-local");
  });
});
