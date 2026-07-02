import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";

const WP_FIELDS = [
  "Priority:", "Proposed:", "Stories / Docs:", "Depends on:",
  "Estimate:", "Trigger to pull:", "Definition of done:",
] as const;

const STALE_P0_DAYS = 14;
const STALE_CHANGELOG_DAYS = 30;

/**
 * Batch invariants for the BACKLOG/TASKS workflow. Per-edit drift checks live
 * in workflow-check.sh (hooks); audits that need dates or whole-file parsing
 * belong here in free static analysis. Returns null when the workflow isn't
 * adopted (no BACKLOG.md) — the Rules analyzer covers absence.
 */
export async function analyzeWorkflow(projectRoot: string, now = new Date()): Promise<AnalyzerResult | null> {
  const backlog = await readFile(join(projectRoot, "BACKLOG.md"), "utf-8").catch(() => null);
  if (backlog === null) return null;

  const issues: DiagnosticIssue[] = [];
  const pSections = extractPSections(backlog);
  const entries = parseWpEntries(pSections);

  // 1. WP entries missing mandatory template fields
  const incomplete = entries
    .map((e) => ({ id: e.id, missing: WP_FIELDS.filter((f) => !e.body.includes(f)) }))
    .filter((e) => e.missing.length > 0);
  if (incomplete.length > 0) {
    const sample = incomplete.slice(0, 3)
      .map((e) => `${e.id} (missing ${e.missing.map((f) => f.replace(":", "")).join(", ")})`)
      .join("; ");
    issues.push({
      analyzer: "Workflow",
      severity: "medium",
      message: `${incomplete.length} WP entr${incomplete.length === 1 ? "y" : "ies"} missing mandatory template fields: ${sample}`,
      fix: "Fill in all 7 fields per the template in BACKLOG.md — unpullable WPs rot",
    });
  }

  // 2. Stale P0: next-sprint items proposed more than 2 weeks ago
  const p0Section = extractSection(backlog, /^## P0/m);
  const staleP0 = parseWpEntries(p0Section).filter((e) => {
    const proposed = e.body.match(/Proposed:\*{0,2}\s*(\d{4}-\d{2}-\d{2})/);
    return proposed !== null && daysBetween(proposed[1], now) > STALE_P0_DAYS;
  });
  if (staleP0.length > 0) {
    issues.push({
      analyzer: "Workflow",
      severity: "medium",
      message: `${staleP0.length} P0 item(s) older than ${STALE_P0_DAYS} days (${staleP0.map((e) => e.id).join(", ")}) — P0 means next sprint`,
      fix: "Pull them into a sprint or demote them (workflow.md priority discipline)",
    });
  }

  // 3. Changelog silence while active WPs exist
  const changelog = extractSection(backlog, /^## Changelog/m);
  const dates = [...changelog.matchAll(/(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]).sort();
  const lastDate = dates[dates.length - 1];
  if (entries.length > 0 && lastDate !== undefined && daysBetween(lastDate, now) > STALE_CHANGELOG_DAYS) {
    issues.push({
      analyzer: "Workflow",
      severity: "low",
      message: `BACKLOG.md changelog has been silent for ${daysBetween(lastDate, now)} days while ${entries.length} WP(s) sit in the backlog — force a review`,
      fix: "Review priorities: promote, demote, or delete stale WPs, and log the pass in ## Changelog",
    });
  }

  const score = Math.max(0, 100 - issues.length * 15);
  return { name: "Workflow", issues, score };
}

interface WpEntry {
  readonly id: string;
  readonly body: string;
}

function extractPSections(backlog: string): string {
  const lines = backlog.split("\n");
  const out: string[] = [];
  let inP = false;
  for (const line of lines) {
    if (/^## P[0-3]/.test(line)) inP = true;
    else if (/^## /.test(line)) inP = false;
    if (inP) out.push(line);
  }
  return out.join("\n");
}

function extractSection(content: string, heading: RegExp): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (heading.test(line)) { inSection = true; continue; }
    else if (/^## /.test(line)) inSection = false;
    if (inSection) out.push(line);
  }
  return out.join("\n");
}

function parseWpEntries(section: string): WpEntry[] {
  const entries: WpEntry[] = [];
  const parts = section.split(/^### /m).slice(1);
  for (const part of parts) {
    const idMatch = part.match(/^(WP-\d{3,})/);
    if (idMatch) entries.push({ id: idMatch[1], body: part });
  }
  return entries;
}

function daysBetween(isoDate: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(isoDate).getTime()) / 86_400_000);
}
