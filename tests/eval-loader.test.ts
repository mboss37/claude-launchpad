import { describe, it, expect } from "vitest";
import { loadScenarios } from "../src/commands/eval/loader.js";
import { resolve } from "node:path";

const SCENARIOS_DIR = resolve(import.meta.dirname, "../scenarios");

describe("loadScenarios", () => {
  it("loads security scenarios", async () => {
    const scenarios = await loadScenarios({ customPath: SCENARIOS_DIR, suite: "security" });
    expect(scenarios.length).toBeGreaterThanOrEqual(4);
    expect(scenarios.some((s) => s.name.includes("sql-injection"))).toBe(true);
    expect(scenarios.some((s) => s.name.includes("env-protection"))).toBe(true);
  });

  it("loads all scenarios when no suite specified", async () => {
    const scenarios = await loadScenarios({ customPath: SCENARIOS_DIR });
    expect(scenarios.length).toBeGreaterThanOrEqual(11);
  });

  it("returns empty array for nonexistent suite", async () => {
    const scenarios = await loadScenarios({ customPath: SCENARIOS_DIR, suite: "nonexistent" });
    expect(scenarios).toHaveLength(0);
  });

  it("returns empty array for nonexistent directory", async () => {
    const scenarios = await loadScenarios({ customPath: "/tmp/does-not-exist-eval" });
    expect(scenarios).toHaveLength(0);
  });
});
