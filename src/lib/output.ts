import chalk from "chalk";
import type { Severity } from "../types/index.js";

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
  console.log(chalk.dim("  Scaffold · Diagnose · Evaluate"));
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

export function printIssue(severity: Severity, analyzer: string, message: string, fix?: string): void {
  const tag = colors.severity(severity);
  console.log(`  ${tag} ${chalk.bold(analyzer)}`);
  console.log(`    ${message}`);
  if (fix) {
    console.log(`    ${chalk.dim("Fix:")} ${chalk.dim(fix)}`);
  }
  console.log();
}
