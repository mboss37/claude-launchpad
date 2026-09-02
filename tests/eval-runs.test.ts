import { describe, it, expect } from "vitest";
import { resolveRuns } from "../src/commands/eval/loader.js";
import {
  buildEvalJsonReport,
  defaultRuntimeMetadata,
  evalReportDir,
  metadataFromResults,
  resolveEvalHarness,
  scenarioSupportsHarness,
  skippedEvalResult,
} from "../src/commands/eval/select.js";

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

describe("resolveEvalHarness", () => {
  it("selects the only detected profile when --harness is omitted", () => {
    expect(resolveEvalHarness(undefined, ["cursor"])).toBe("cursor");
    expect(resolveEvalHarness(undefined, ["claude"])).toBe("claude");
  });

  it("exits with an ambiguity error when both profiles are detected", () => {
    expect(() => resolveEvalHarness(undefined, ["claude", "cursor"])).toThrow(
      /--harness claude|--harness cursor/,
    );
  });

  it("uses an explicit --harness even when both profiles exist", () => {
    expect(resolveEvalHarness("cursor", ["claude", "cursor"])).toBe("cursor");
  });
});

describe("scenario harness support", () => {
  it("treats a missing harnesses field as both", () => {
    expect(scenarioSupportsHarness({}, "claude")).toBe(true);
    expect(scenarioSupportsHarness({}, "cursor")).toBe(true);
  });

  it("reports SKIP with a reason when the scenario excludes the harness", () => {
    expect(scenarioSupportsHarness({ harnesses: ["claude"] }, "cursor")).toBe(
      false,
    );
    const skipped = skippedEvalResult("security/env-read-attempt", "cursor");
    expect(skipped.skipped).toBe(true);
    expect(skipped.passed).toBe(false);
    expect(skipped.skipReason).toMatch(/cursor/i);
    expect(skipped.runs).toBe(0);
  });
});

describe("eval report metadata", () => {
  it("writes Cursor reports under .cursor/eval", () => {
    expect(evalReportDir("/proj", "cursor")).toBe("/proj/.cursor/eval");
    expect(evalReportDir("/proj", "claude")).toBe("/proj/.claude/eval");
  });

  it("includes runtime metadata without changing Claude result scoring keys", () => {
    const report = buildEvalJsonReport(
      [
        {
          scenario: "security/env-protection",
          score: 10,
          maxScore: 10,
          passed: true,
          runs: 3,
          checks: [{ label: "blocked", passed: true, points: 10 }],
        },
      ],
      {
        harness: "claude",
        runtime: "sdk-local",
        productVersion: "unknown",
        model: "haiku",
        configSources: ["project"],
      },
    );
    expect(report.results[0]).toMatchObject({
      scenario: "security/env-protection",
      score: 10,
      maxScore: 10,
      passed: true,
    });
    expect(report.harness).toBe("claude");
    expect(report.runtime).toBe("sdk-local");
    expect(report.model).toBe("haiku");
    expect(report.runs).toBe(3);
    expect(report.passed).toBe(true);
  });

  it("uses unknown runtime metadata when no scenario actually ran", () => {
    const fallback = defaultRuntimeMetadata("cursor", "auto");
    const skipped = skippedEvalResult("x", "cursor");
    expect(metadataFromResults([skipped], fallback)).toMatchObject({
      harness: "cursor",
      runtime: "unknown",
      productVersion: "unknown",
      model: "unknown",
      requestedModel: "auto",
    });
    expect(buildEvalJsonReport([skipped], fallback).runs).toBe(0);
  });
});
