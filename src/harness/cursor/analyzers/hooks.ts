import { access } from "node:fs/promises";
import { join } from "node:path";
import type { AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";
import type { CursorConfig, CursorHookConfig } from "../types.js";

const SECURITY_COMMANDS = [
  ".cursor/hooks/env-read.sh",
  ".cursor/hooks/destructive-shell.sh",
] as const;

export async function analyzeCursorHooks(
  config: CursorConfig,
  root: string,
): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [...parseErrorIssues(config)];
  if (config.hooks.length === 0 && config.parseErrors.length === 0) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message: "No Cursor hooks configured",
      fix: "Run `claude-launchpad init --harness cursor` to generate fail-closed security hooks",
    });
  }

  for (const hook of config.hooks) {
    if (isSecurityHook(hook) && hook.failClosed !== true) {
      issues.push({
        analyzer: "Hooks",
        severity: "high",
        message: `security hook is not fail-closed (${hook.command ?? hook.event})`,
        fix: "Set failClosed: true on .env and destructive-shell hooks",
      });
    }
    await addMissingScriptIssue(issues, root, hook.command);
  }

  return { name: "Hooks", issues, score: scoreIssues(issues) };
}

function parseErrorIssues(config: CursorConfig): DiagnosticIssue[] {
  return config.parseErrors
    .filter((error) => error.path.endsWith("hooks.json"))
    .map((error) => ({
      analyzer: "Hooks",
      severity: "high" as const,
      message: `Malformed ${error.path}: ${error.message}`,
      fix: "Fix the JSON syntax; doctor will not overwrite it",
    }));
}

function isSecurityHook(hook: CursorHookConfig): boolean {
  return SECURITY_COMMANDS.includes(
    (hook.command ?? "") as (typeof SECURITY_COMMANDS)[number],
  );
}

async function addMissingScriptIssue(
  issues: DiagnosticIssue[],
  root: string,
  command: string | undefined,
): Promise<void> {
  if (!command || !command.startsWith(".cursor/hooks/")) return;
  try {
    await access(join(root, command));
  } catch {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message: `Hook script missing: ${command}`,
      fix: "Run `claude-launchpad init --harness cursor` to restore Launchpad hook scripts",
    });
  }
}

function scoreIssues(issues: ReadonlyArray<DiagnosticIssue>): number {
  return Math.max(
    0,
    100 - issues.filter((issue) => issue.severity !== "info").length * 25,
  );
}
