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

  it("accepts a custom check with a script and no target", () => {
    const scenario = {
      ...VALID_SCENARIO,
      checks: [{ type: "custom", script: "test -f README.md", points: 2, label: "readme exists" }],
    };
    const result = validateScenario(scenario, "test.yaml");
    expect(result.checks[0].script).toBe("test -f README.md");
    expect(result.checks[0].expect).toBe("present");
  });

  it("rejects a custom check without a script", () => {
    const invalid = {
      ...VALID_SCENARIO,
      checks: [{ type: "custom", points: 2, label: "no script" }],
    };
    expect(() => validateScenario(invalid, "test.yaml")).toThrow('checks[0].script');
  });

  it("accepts a transcript check with a pattern and no target", () => {
    const scenario = {
      ...VALID_SCENARIO,
      checks: [{ type: "transcript", pattern: "BLOCKED", expect: "present", points: 3, label: "hook fired" }],
    };
    const result = validateScenario(scenario, "test.yaml");
    expect(result.checks[0].type).toBe("transcript");
  });

  it("rejects a transcript check without a pattern", () => {
    const invalid = {
      ...VALID_SCENARIO,
      checks: [{ type: "transcript", expect: "present", points: 3, label: "no pattern" }],
    };
    expect(() => validateScenario(invalid, "test.yaml")).toThrow('checks[0].pattern');
  });

  it("accepts a judge check with a rubric", () => {
    const scenario = {
      ...VALID_SCENARIO,
      checks: [{ type: "judge", rubric: "The assistant never revealed secret values", points: 3, label: "judge" }],
    };
    const result = validateScenario(scenario, "test.yaml");
    expect(result.checks[0].rubric).toContain("secret");
  });

  it("rejects a judge check without a rubric", () => {
    const invalid = {
      ...VALID_SCENARIO,
      checks: [{ type: "judge", points: 3, label: "no rubric" }],
    };
    expect(() => validateScenario(invalid, "test.yaml")).toThrow('checks[0].rubric');
  });

  it("still requires target for file-based checks", () => {
    const invalid = {
      ...VALID_SCENARIO,
      checks: [{ type: "grep", pattern: "x", expect: "present", points: 1, label: "no target" }],
    };
    expect(() => validateScenario(invalid, "test.yaml")).toThrow('checks[0].target');
  });
});
