import chalk from "chalk";
import type { Severity, AnalyzerResult } from "../types/index.js";

// ─── Colors ───

export const colors = {
  success: chalk.green,
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.cyan,
  dim: chalk.dim,
  bold: chalk.bold,
  score: (score: number): string => {
    if (score >= 80) return chalk.green.bold(`${score}%`);
    if (score >= 60) return chalk.yellow.bold(`${score}%`);
    return chalk.red.bold(`${score}%`);
  },
  severity: (sev: Severity): string => {
    const map: Record<Severity, (s: string) => string> = {
      critical: chalk.bgRed.white.bold,
      high: chalk.red.bold,
      medium: chalk.yellow,
      low: chalk.cyan,
      info: chalk.dim,
    };
    return map[sev](` ${sev.toUpperCase()} `);
  },
} as const;

// ─── Prefixed Output ───

export const log = {
  success: (msg: string): void => console.log(`  ${chalk.green("✓")} ${msg}`),
  error: (msg: string): void => console.log(`  ${chalk.red("✗")} ${msg}`),
  warn: (msg: string): void => console.log(`  ${chalk.yellow("!")} ${msg}`),
  step: (msg: string): void => console.log(`  ${chalk.cyan("→")} ${msg}`),
  info: (msg: string): void => console.log(`  ${chalk.dim("·")} ${msg}`),
  blank: (): void => console.log(),
} as const;

// ─── Banner ───

export function printBanner(): void {
  log.blank();
  console.log(chalk.cyan.bold("  Claude Launchpad"));
  console.log(chalk.dim("  Scaffold · Diagnose · Evaluate · Remember"));
  log.blank();
}

// ─── Score Display ───

export function printScoreCard(label: string, score: number, max: number = 100): void {
  const pct = Math.round((score / max) * 100);
  const bar = renderBar(pct, 20);
  console.log(`  ${chalk.bold(label.padEnd(22))} ${bar} ${colors.score(pct).padStart(12)}`);
}

function renderBar(pct: number, width: number): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = pct >= 80 ? chalk.green : pct >= 60 ? chalk.yellow : chalk.red;
  return color("━".repeat(filled)) + chalk.dim("─".repeat(empty));
}

// ─── Issues List (replaces table) ───

export function printIssue(severity: Severity, _analyzer: string, message: string): void {
  const sevLabel: Record<Severity, string> = {
    critical: chalk.bgRed.white.bold(" CRIT "),
    high: chalk.red.bold("HIGH"),
    medium: chalk.yellow("MED "),
    low: chalk.dim("LOW "),
    info: chalk.dim("INFO"),
  };
  console.log(`   ${sevLabel[severity]}  ${message}`);
}

// ─── Report Rendering (shared by doctor + watcher) ───

export function renderDoctorReport(results: ReadonlyArray<AnalyzerResult>, options?: { afterFix?: boolean }): {
  overallScore: number;
  actionableCount: number;
} {
  const overallScore = Math.round(
    results.reduce((sum, r) => sum + r.score, 0) / results.length,
  );

  for (const result of results) {
    printScoreCard(result.name, result.score);
  }
  log.blank();
  printScoreCard("Overall", overallScore);
  log.blank();

  const allIssues = results.flatMap((r) => r.issues);
  const actionable = allIssues.filter((i) => i.severity !== "info");

  if (actionable.length === 0) {
    log.success("No issues found. Your configuration looks solid.");
    return { overallScore, actionableCount: 0 };
  }

  const sorted = [...actionable].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
  });

  for (const issue of sorted) {
    printIssue(issue.severity, issue.analyzer, issue.message);
  }

  log.blank();
  if (options?.afterFix) {
    log.info(`${actionable.length} remaining issue(s) require manual intervention.`);
  } else {
    log.info(`${actionable.length} issue(s). Run ${chalk.bold("--fix")} to auto-repair or ${chalk.bold("--fix --dry-run")} to preview.`);
  }
  return { overallScore, actionableCount: actionable.length };
}
