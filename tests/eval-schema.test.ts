import { describe, it, expect } from "vitest";
import { validateScenario } from "../src/commands/eval/schema.js";

const VALID_SCENARIO = {
  name: "test/example",
  description: "A test scenario",
  setup: {
    files: [{ path: "src/test.ts", content: "// test" }],
    instructions: "Do the thing",
  },
  prompt: "Fix the test",
  checks: [
    {
      type: "grep",
      pattern: "expect",
      target: "src/test.ts",
      expect: "present",
      points: 5,
      label: "Has expect call",
    },
  ],
  passingScore: 4,
  runs: 3,
};

describe("validateScenario", () => {
  it("accepts a valid scenario", () => {
    const result = validateScenario(VALID_SCENARIO, "test.yaml");
    expect(result.name).toBe("test/example");
    expect(result.checks).toHaveLength(1);
    expect(result.runs).toBe(3);
  });

  it("defaults runs to 3 if not specified", () => {
    const { runs, ...withoutRuns } = VALID_SCENARIO;
    const result = validateScenario(withoutRuns, "test.yaml");
    expect(result.runs).toBe(3);
  });

  it("rejects missing name", () => {
    const { name, ...invalid } = VALID_SCENARIO;
    expect(() => validateScenario(invalid, "test.yaml")).toThrow('"name" must be a non-empty string');
  });

  it("rejects missing checks", () => {
    const invalid = { ...VALID_SCENARIO, checks: [] };
    expect(() => validateScenario(invalid, "test.yaml")).toThrow('"checks" must be a non-empty array');
  });

  it("rejects check with invalid type", () => {
    const invalid = {
      ...VALID_SCENARIO,
      checks: [{ ...VALID_SCENARIO.checks[0], type: "banana" }],
    };
    expect(() => validateScenario(invalid, "test.yaml")).toThrow("checks[0].type must be one of");
  });

  it("rejects check with negative points", () => {
    const invalid = {
      ...VALID_SCENARIO,
      checks: [{ ...VALID_SCENARIO.checks[0], points: -1 }],
    };
    expect(() => validateScenario(invalid, "test.yaml")).toThrow("non-negative number");
  });

  it("rejects non-object input", () => {
    expect(() => validateScenario("not an object", "test.yaml")).toThrow("must be a YAML object");
    expect(() => validateScenario(null, "test.yaml")).toThrow("must be a YAML object");
  });
});
