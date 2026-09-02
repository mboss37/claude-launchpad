import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { log, printScoreCard } from "../../lib/output.js";
import type { EvalRunResult } from "../../types/index.js";
import type { RuntimeMetadata } from "./runtime.js";
import { evalReportDir } from "./select.js";

export function renderEvalReport(results: ReadonlyArray<EvalRunResult>): void {
  for (const result of results) {
    if (result.skipped) {
      console.log(
        `  ${chalk.yellow("○")} ${chalk.bold(result.scenario)}  SKIP  ${chalk.dim(result.skipReason ?? "")}`,
      );
      continue;
    }
    const icon = result.passed ? chalk.green("✓") : chalk.red("✗");
    const status = result.passed ? chalk.green("PASS") : chalk.red("FAIL");
    console.log(
      `  ${icon} ${chalk.bold(result.scenario)}  ${result.score}/${result.maxScore}  ${status}`,
    );
    for (const check of result.checks.filter((item) => !item.passed)) {
      console.log(`    ${chalk.red("✗")} ${chalk.dim(check.label)}`);
    }
  }

  log.blank();
  const scored = results.filter((result) => !result.skipped);
  const totalScore = scored.reduce((sum, result) => sum + result.score, 0);
  const totalMax = scored.reduce((sum, result) => sum + result.maxScore, 0);
  const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  printScoreCard("Config Eval Score", pct);
  log.blank();

  const passed = scored.filter((result) => result.passed).length;
  const failed = scored.length - passed;
  const skipped = results.length - scored.length;
  if (failed === 0 && skipped === 0) {
    log.success(`All ${passed} scenario(s) passed.`);
    return;
  }
  log.warn(
    `${passed} passed, ${failed} failed, ${skipped} skipped out of ${results.length} scenario(s).`,
  );
}

export async function saveEvalReport(
  results: ReadonlyArray<EvalRunResult>,
  projectRoot: string,
  metadata: RuntimeMetadata,
  suite?: string,
  options?: { readonly silent?: boolean },
): Promise<void> {
  const scored = results.filter((result) => !result.skipped);
  const totalScore = scored.reduce((sum, result) => sum + result.score, 0);
  const totalMax = scored.reduce((sum, result) => sum + result.maxScore, 0);
  const pct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  const passed = scored.filter((result) => result.passed).length;
  const failed = scored.length - passed;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const skipped = results.length - scored.length;
  const lines = reportLines(results, metadata, {
    pct,
    passed,
    failed,
    skipped,
    suite,
    timestamp,
  });
  const evalDir = evalReportDir(projectRoot, metadata.harness);
  await mkdir(evalDir, { recursive: true });
  const filename = `eval-${suite ?? "all"}-${timestamp}.md`;
  await writeFile(join(evalDir, filename), lines.join("\n"));
  const relative =
    metadata.harness === "cursor" ? ".cursor/eval" : ".claude/eval";
  if (!options?.silent) {
    log.success(`Report saved to ${relative}/${filename}`);
  }
}

function reportLines(
  results: ReadonlyArray<EvalRunResult>,
  metadata: RuntimeMetadata,
  summary: {
    readonly pct: number;
    readonly passed: number;
    readonly failed: number;
    readonly skipped: number;
    readonly suite?: string;
    readonly timestamp: string;
  },
): string[] {
  const totalRuns = results.reduce(
    (sum, result) => sum + (result.runs ?? 0),
    0,
  );
  const lines = [
    `# Eval Report — ${summary.timestamp}`,
    "",
    `**Score: ${summary.pct}%** (${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped out of ${results.length} scenarios)`,
    "",
    `- Suite: ${summary.suite ?? "all"}`,
    `- Harness: ${metadata.harness}`,
    `- Runtime: ${metadata.runtime}`,
    `- Product: ${metadata.productVersion}`,
    `- Model: ${metadata.model}`,
    `- Config: ${metadata.configSources.join(", ")}`,
    `- Runs: ${totalRuns}`,
    `- Date: ${new Date().toISOString().split("T")[0]}`,
    "",
    "## Results",
    "",
  ];
  for (const result of results) {
    if (result.skipped) {
      lines.push(`### ${result.scenario} — SKIP`);
      lines.push(`- ${result.skipReason ?? "unsupported harness"}`);
      lines.push("");
      continue;
    }
    lines.push(
      `### ${result.scenario} — ${result.score}/${result.maxScore} ${result.passed ? "PASS" : "FAIL"}`,
    );
    lines.push(`- Runs: ${result.runs ?? "unknown"}`);
    for (const check of result.checks) {
      lines.push(
        `- ${check.passed ? "PASSED" : "FAILED"}: ${check.label} (${check.points} pts)`,
      );
    }
    lines.push("");
  }
  return lines;
}
