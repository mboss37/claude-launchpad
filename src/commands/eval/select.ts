import { join } from "node:path";
import type { EvalRunResult } from "../../types/index.js";
import type { HarnessId } from "../../harness/types.js";
import type { EvalRuntime, RuntimeMetadata } from "./runtime.js";
import { claudeEvalRuntime } from "./runtimes/claude.js";
import { cursorEvalRuntime } from "./runtimes/cursor.js";

export interface EvalJsonReport {
  readonly results: ReadonlyArray<EvalRunResult>;
  readonly overallScore: number;
  readonly overallMax: number;
  readonly passed: boolean;
  readonly timestamp: string;
  readonly harness: HarnessId;
  readonly runtime: RuntimeMetadata["runtime"] | "unknown";
  readonly productVersion: string;
  readonly model: string;
  readonly configSources: ReadonlyArray<string>;
  readonly runs: number;
}

export function parseEvalHarness(value: string): HarnessId {
  if (value === "claude" || value === "cursor") return value;
  throw new Error("Eval --harness must be claude or cursor");
}

export function resolveEvalHarness(
  explicit: HarnessId | undefined,
  detected: ReadonlyArray<HarnessId>,
): HarnessId {
  if (explicit) return explicit;
  if (detected.length === 1) return detected[0];
  if (detected.length === 0) {
    throw new Error(
      "No agent harness detected. Pass --harness claude or --harness cursor.",
    );
  }
  throw new Error(
    "Both Claude and Cursor configs were detected. Pass --harness claude or --harness cursor.",
  );
}

export function scenarioSupportsHarness(
  scenario: { readonly harnesses?: ReadonlyArray<HarnessId> },
  harness: HarnessId,
): boolean {
  return (
    scenario.harnesses === undefined || scenario.harnesses.includes(harness)
  );
}

export function skippedEvalResult(
  scenario: string,
  harness: HarnessId,
): EvalRunResult {
  return {
    scenario,
    score: 0,
    maxScore: 0,
    passed: false,
    checks: [],
    skipped: true,
    skipReason: `Scenario does not support harness ${harness}`,
  };
}

export function evalReportDir(projectRoot: string, harness: HarnessId): string {
  return harness === "cursor"
    ? join(projectRoot, ".cursor", "eval")
    : join(projectRoot, ".claude", "eval");
}

export function evalRuntimeFor(harness: HarnessId): EvalRuntime {
  return harness === "cursor" ? cursorEvalRuntime : claudeEvalRuntime;
}

export function defaultRuntimeMetadata(
  harness: HarnessId,
  model?: string,
): RuntimeMetadata {
  return {
    harness,
    runtime: "sdk-local",
    productVersion: "unknown",
    model: model ?? "default",
    configSources: ["project"],
  };
}

export function metadataFromResults(
  results: ReadonlyArray<EvalRunResult>,
  fallback: RuntimeMetadata,
): RuntimeMetadata {
  const found = results.find((result) => result.metadata)?.metadata;
  return found ?? fallback;
}

export function buildEvalJsonReport(
  results: ReadonlyArray<EvalRunResult>,
  metadata: RuntimeMetadata,
  runs: number,
): EvalJsonReport {
  const scored = results.filter((result) => !result.skipped);
  const overallScore = scored.reduce((sum, result) => sum + result.score, 0);
  const overallMax = scored.reduce((sum, result) => sum + result.maxScore, 0);
  return {
    results,
    overallScore,
    overallMax,
    passed: overallMax > 0 && overallScore >= overallMax * 0.8,
    timestamp: new Date().toISOString(),
    harness: metadata.harness,
    runtime: metadata.runtime,
    productVersion: metadata.productVersion,
    model: metadata.model,
    configSources: metadata.configSources,
    runs,
  };
}

export async function listCursorModelChoices(): Promise<
  ReadonlyArray<{ name: string; value: string }>
> {
  try {
    const sdk = await import("@cursor/sdk");
    const models = await sdk.Cursor.models.list();
    if (models.length === 0) return [{ name: "auto", value: "auto" }];
    return models.map((model) => ({
      name: model.displayName || model.id,
      value: model.id,
    }));
  } catch {
    return [{ name: "auto — CLI default", value: "auto" }];
  }
}
