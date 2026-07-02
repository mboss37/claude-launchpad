import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluateChecks, type CheckContext } from "../src/commands/eval/checks.js";
import type { EvalCheck } from "../src/types/index.js";

let testDir: string;

function ctx(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    transcript: "",
    judge: async () => false,
    ...overrides,
  };
}

function check(overrides: Partial<EvalCheck>): EvalCheck {
  return {
    type: "grep",
    expect: "present",
    points: 1,
    label: "test check",
    ...overrides,
  } as EvalCheck;
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "eval-checks-"));
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("evaluateChecks", () => {
  it("grep still passes against a target file", async () => {
    await writeFile(join(testDir, "a.ts"), "const x = process.env.PORT;");
    const results = await evaluateChecks(
      [check({ type: "grep", pattern: "process\\.env", target: "a.ts" })],
      testDir,
      ctx(),
    );
    expect(results[0].passed).toBe(true);
  });

  it("custom check passes when the script exits 0", async () => {
    await writeFile(join(testDir, "present.txt"), "hi");
    const results = await evaluateChecks(
      [check({ type: "custom", script: "test -f present.txt" })],
      testDir,
      ctx(),
    );
    expect(results[0].passed).toBe(true);
  });

  it("custom check fails when the script exits non-zero", async () => {
    const results = await evaluateChecks(
      [check({ type: "custom", script: "test -f missing.txt" })],
      testDir,
      ctx(),
    );
    expect(results[0].passed).toBe(false);
  });

  it("custom check runs inside the sandbox directory", async () => {
    await writeFile(join(testDir, "marker"), "x");
    const results = await evaluateChecks(
      [check({ type: "custom", script: "grep -q x marker" })],
      testDir,
      ctx(),
    );
    expect(results[0].passed).toBe(true);
  });

  it("transcript check matches the captured session", async () => {
    const results = await evaluateChecks(
      [check({ type: "transcript", pattern: "BLOCKED: \\.env" })],
      testDir,
      ctx({ transcript: '{"type":"tool_result","content":"BLOCKED: .env files contain secrets"}' }),
    );
    expect(results[0].passed).toBe(true);
  });

  it("transcript check with expect absent fails when the pattern appears", async () => {
    const results = await evaluateChecks(
      [check({ type: "transcript", pattern: "SECRET_VALUE", expect: "absent" })],
      testDir,
      ctx({ transcript: "leaked SECRET_VALUE here" }),
    );
    expect(results[0].passed).toBe(false);
  });

  it("transcript check with expect absent passes on a clean transcript", async () => {
    const results = await evaluateChecks(
      [check({ type: "transcript", pattern: "SECRET_VALUE", expect: "absent" })],
      testDir,
      ctx({ transcript: "nothing to see" }),
    );
    expect(results[0].passed).toBe(true);
  });

  it("judge check delegates rubric and transcript to the judge", async () => {
    const seen: string[] = [];
    const results = await evaluateChecks(
      [check({ type: "judge", rubric: "no secrets revealed" })],
      testDir,
      ctx({
        transcript: "the session transcript",
        judge: async (rubric, transcript) => {
          seen.push(rubric, transcript);
          return true;
        },
      }),
    );
    expect(results[0].passed).toBe(true);
    expect(seen).toEqual(["no secrets revealed", "the session transcript"]);
  });

  it("judge check fails closed when the judge throws", async () => {
    const results = await evaluateChecks(
      [check({ type: "judge", rubric: "anything" })],
      testDir,
      ctx({ judge: async () => { throw new Error("api down"); } }),
    );
    expect(results[0].passed).toBe(false);
  });
});
