import { readFile } from "node:fs/promises";
import { basename, join, dirname } from "node:path";
import { fileExists } from "../../../lib/fs-utils.js";
import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";

export async function analyzeRules(config: ClaudeConfig): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];

  // Check for .claudeignore
  const projectRoot = config.claudeMdPath ? dirname(config.claudeMdPath) : process.cwd();
  const hasClaudeignore = await fileExists(join(projectRoot, ".claudeignore"));
  if (!hasClaudeignore) {
    issues.push({
      analyzer: "Rules",
      severity: "low",
      message: "No .claudeignore found — Claude may read noise files (node_modules, dist, lockfiles)",
      fix: "Run `claude-launchpad init` or `doctor --fix` to generate one",
    });
  }

  if (config.rules.length === 0) {
    issues.push({
      analyzer: "Rules",
      severity: "low",
      message: "No .claude/rules/ files found",
      fix: "Move detailed conventions from CLAUDE.md to .claude/rules/*.md (auto-loaded, saves budget)",
    });
    return { name: "Rules", issues, score: 60 };
  }

  // Check for empty or near-empty rule files
  for (const rulePath of config.rules) {
    try {
      const content = await readFile(rulePath, "utf-8");
      const trimmed = content.trim();
      if (trimmed.length === 0) {
        issues.push({
          analyzer: "Rules",
          severity: "low",
          message: `Empty rule file: ${basename(rulePath)}`,
          fix: `Add content to ${basename(rulePath)} or delete it`,
        });
      } else if (trimmed.length < 20) {
        issues.push({
          analyzer: "Rules",
          severity: "info",
          message: `Very short rule file (${trimmed.length} chars): ${basename(rulePath)}`,
        });
      }
    } catch {
      issues.push({
        analyzer: "Rules",
        severity: "low",
        message: `Could not read rule file: ${basename(rulePath)}`,
      });
    }
  }

  const score = Math.max(0, 100 - issues.length * 10);
  return { name: "Rules", issues, score };
}

