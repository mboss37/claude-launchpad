import { describe, it, expect } from "vitest";
import { resolveRuns } from "../src/commands/eval/loader.js";

describe("resolveRuns", () => {
  it("uses the scenario's runs when the user did not choose explicitly", () => {
    expect(resolveRuns(1, 3, false)).toBe(1);
  });

  it("lets an explicit user choice override the scenario", () => {
    expect(resolveRuns(1, 5, true)).toBe(5);
  });

  it("falls back to the CLI default when the scenario defines none", () => {
    expect(resolveRuns(undefined, 3, false)).toBe(3);
  });
});
