import { describe, expect, it } from "vitest";
import { scoreIssues } from "../src/harness/cursor/analyzers/score.js";

describe("scoreIssues", () => {
  it("starts at 100 and subtracts 25 per non-info issue", () => {
    expect(scoreIssues([])).toBe(100);
    expect(
      scoreIssues([
        {
          analyzer: "Hooks",
          severity: "high",
          message: "a",
        },
        {
          analyzer: "Hooks",
          severity: "info",
          message: "ignored",
        },
      ]),
    ).toBe(75);
  });

  it("does not go below 0", () => {
    expect(
      scoreIssues(
        Array.from({ length: 5 }, () => ({
          analyzer: "Hooks",
          severity: "medium" as const,
          message: "x",
        })),
      ),
    ).toBe(0);
  });
});
