import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";
import { fileExists } from "../../../lib/fs-utils.js";
import { CURSOR_VERIFICATION_RULE_VERSION } from "../generators.js";
import type { CursorConfig } from "../types.js";
import { scoreIssues } from "./score.js";

export async function analyzeCursorRules(
  config: CursorConfig,
  root: string,
): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];
  const verificationPath = join(root, ".cursor", "rules", "verification.mdc");
  if (!(await fileExists(verificationPath))) {
    issues.push({
      analyzer: "Rules",
      severity: "medium",
      message:
        "No .cursor/rules/verification.mdc found — nothing stops premature 'done' claims",
      fix: "Run `claude-launchpad doctor --fix` to generate verification.mdc",
    });
    return { name: "Rules", issues, score: scoreIssues(issues) };
  }

  const content = await readFile(verificationPath, "utf-8");
  const match = content.match(/<!-- lp-cursor-verification-version: (\d+) -->/);
  const version = match ? Number.parseInt(match[1] ?? "", 10) : null;
  if (version !== null && version < CURSOR_VERIFICATION_RULE_VERSION) {
    issues.push({
      analyzer: "Rules",
      severity: "low",
      message: `verification.mdc rule is outdated (v${version}, latest v${CURSOR_VERIFICATION_RULE_VERSION})`,
      fix: "Run `claude-launchpad doctor --fix` to refresh verification.mdc",
    });
  }

  if (!hasFrontmatter(content)) {
    issues.push({
      analyzer: "Rules",
      severity: "low",
      message: "verification.mdc is missing Cursor MDC frontmatter",
      fix: "Add description and alwaysApply frontmatter",
    });
  }

  void config;
  return { name: "Rules", issues, score: scoreIssues(issues) };
}

function hasFrontmatter(content: string): boolean {
  return content.startsWith("---\n") && content.includes("\nalwaysApply:");
}
