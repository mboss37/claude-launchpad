import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  available: true,
  runScenario: vi.fn(),
  saveReport: vi.fn(),
}));

vi.mock("../src/harness/registry.js", () => ({
  detectHarnesses: vi.fn(async () => ["cursor"]),
}));

vi.mock("../src/commands/eval/loader.js", () => ({
  loadScenarios: vi.fn(async () => [
    {
      name: "security/example",
      description: "example",
      setup: { files: [] },
      prompt: "do it",
      checks: [
        {
          type: "file-exists",
          target: "out.txt",
          expect: "present",
          points: 1,
          label: "output exists",
        },
      ],
      passingScore: 1,
      runs: 1,
    },
  ]),
  resolveRuns: vi.fn(() => 1),
}));

vi.mock("../src/commands/eval/runner.js", () => ({
  runScenarioWithRetries: state.runScenario,
}));

vi.mock("../src/commands/eval/report.js", () => ({
  renderEvalReport: vi.fn(),
  saveEvalReport: state.saveReport,
}));

vi.mock("../src/commands/eval/select.js", async () => {
  const actual = await vi.importActual<
    typeof import("../src/commands/eval/select.js")
  >("../src/commands/eval/select.js");
  return {
    ...actual,
    evalRuntimeFor: () => ({
      id: "cursor",
      isAvailable: async () => state.available,
      prepareSandbox: async () => undefined,
      run: async () => {
        throw new Error("not called directly");
      },
    }),
  };
});

vi.mock("ora", () => ({
  default: () => ({
    start() {
      return this;
    },
    succeed: vi.fn(),
    fail: vi.fn(),
  }),
}));

import { createEvalCommand } from "../src/commands/eval/index.js";

describe("eval command runtime gate", () => {
  beforeEach(() => {
    state.available = true;
    state.runScenario.mockReset();
    state.saveReport.mockReset();
  });

  it("exits before running scenarios when the runtime is unavailable", async () => {
    state.available = false;
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("EXIT");
    }) as never);
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        createEvalCommand().parseAsync(["--harness", "cursor", "--json"], {
          from: "user",
        }),
      ).rejects.toThrow("EXIT");
      expect(state.runScenario).not.toHaveBeenCalled();
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalled();
    } finally {
      exit.mockRestore();
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });

  it("emits one valid JSON document when a scenario errors", async () => {
    state.runScenario.mockRejectedValue(new Error("runtime failed"));
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await createEvalCommand().parseAsync(
        ["--harness", "cursor", "--runs", "1", "--json"],
        { from: "user" },
      );
      expect(stdout).toHaveBeenCalledTimes(1);
      const output = String(stdout.mock.calls[0][0]);
      expect(() => JSON.parse(output)).not.toThrow();
      expect(JSON.parse(output).results[0].passed).toBe(false);
      expect(JSON.parse(output).results[0].runs).toBe(0);
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });
});
