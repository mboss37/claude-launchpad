import { log, renderDoctorReport } from "../../lib/output.js";
import type { AnalyzerResult } from "../../types/index.js";
import { parseCursorConfig } from "../../harness/cursor/parser.js";
import { runCursorAnalyzers } from "../../harness/cursor/doctor.js";
import { applyCursorFixes } from "../../harness/cursor/fixer.js";

export async function applyCursorReportFixes(
  results: ReadonlyArray<AnalyzerResult>,
  root: string,
  dryRun: boolean,
): Promise<{ written: boolean; preview: ReadonlyArray<string> }> {
  const issues = results
    .flatMap((result) => result.issues)
    .filter((issue) => issue.severity !== "info");
  const preview = issues
    .map((issue) => issue.fix)
    .filter((fix): fix is string => Boolean(fix));
  if (dryRun || issues.length === 0) {
    return { written: false, preview };
  }
  let pending = issues;
  let totalFixed = 0;
  for (let pass = 0; pass < 3 && pending.length > 0; pass++) {
    const { fixed } = await applyCursorFixes(pending, root);
    totalFixed += fixed;
    if (fixed === 0) break;
    const next = await runCursorAnalyzers(await parseCursorConfig(root), root);
    pending = next
      .flatMap((result) => result.issues)
      .filter((issue) => issue.severity !== "info");
  }
  return { written: totalFixed > 0, preview };
}

export async function applyCursorFixesReport(
  results: ReadonlyArray<AnalyzerResult>,
  opts: { readonly path: string; readonly dryRun?: boolean },
): Promise<void> {
  const { written, preview } = await applyCursorReportFixes(
    results,
    opts.path,
    Boolean(opts.dryRun),
  );
  if (opts.dryRun) {
    log.blank();
    log.step("Dry run — would apply:");
    log.blank();
    for (const line of preview) log.info(`  ${line}`);
    log.blank();
    log.success(
      `${preview.length} fix(es) available. Run --fix without --dry-run to apply.`,
    );
    return;
  }
  if (!written) {
    renderDoctorReport([...results]);
    log.success("Nothing to fix.");
    return;
  }
  log.blank();
  log.step("Applying Cursor fixes...");
  log.blank();
  const updated = [
    ...(await runCursorAnalyzers(
      await parseCursorConfig(opts.path),
      opts.path,
    )),
  ];
  renderDoctorReport(updated, { afterFix: true });
}
