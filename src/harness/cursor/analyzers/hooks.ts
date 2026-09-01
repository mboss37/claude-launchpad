import { access } from "node:fs/promises";
import { join } from "node:path";
import type { AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";
import { detectProject } from "../../../lib/detect.js";
import { fileExists, readFileOrNull } from "../../../lib/fs-utils.js";
import { CURSOR_FORMATTERS, CURSOR_HOOK_VERSION } from "../hook-scripts.js";
import type { CursorConfig, CursorHookConfig } from "../types.js";
import { scoreIssues } from "./score.js";

const SECURITY_COMMANDS = [
  ".cursor/hooks/env-read.sh",
  ".cursor/hooks/destructive-shell.sh",
] as const;

const REQUIRED_HOOKS: ReadonlyArray<{
  readonly command: string;
  readonly message: string;
  readonly severity: DiagnosticIssue["severity"];
  readonly when?: (language: string | null) => boolean;
}> = [
  {
    command: ".cursor/hooks/env-read.sh",
    message: "missing .env read protection",
    severity: "high",
  },
  {
    command: ".cursor/hooks/destructive-shell.sh",
    message: "missing destructive-shell protection",
    severity: "high",
  },
  {
    command: ".cursor/hooks/auto-format.sh",
    message: "missing auto-format",
    severity: "medium",
    when: (language) => Boolean(language && language in CURSOR_FORMATTERS),
  },
  {
    command: ".cursor/hooks/workflow-check.sh",
    message: "missing workflow check",
    severity: "medium",
  },
  {
    command: ".cursor/hooks/session-context.sh",
    message: "missing session context",
    severity: "low",
  },
];

export async function analyzeCursorHooks(
  config: CursorConfig,
  root: string,
): Promise<AnalyzerResult> {
  const language = (await detectProject(root)).language;
  const issues: DiagnosticIssue[] = [...parseErrorIssues(config)];
  if (config.hooks.length === 0 && config.parseErrors.length === 0) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message: "No Cursor hooks configured",
      fix: "Run `claude-launchpad doctor --fix` to generate fail-closed security hooks",
    });
  }

  if (config.hooks.length > 0 && config.parseErrors.length === 0) {
    for (const required of REQUIRED_HOOKS) {
      if (required.when && !required.when(language)) continue;
      if (hasCommand(config, required.command)) continue;
      issues.push({
        analyzer: "Hooks",
        severity: required.severity,
        message: required.message,
        fix: "Run `claude-launchpad doctor --fix` to merge Launchpad hooks",
      });
    }
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
  await addStaleScriptIssues(issues, root);

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
      fix: "Run `claude-launchpad doctor --fix` to restore Launchpad hook scripts",
    });
  }
}

function hasCommand(config: CursorConfig, command: string): boolean {
  return config.hooks.some((hook) => hook.command === command);
}

async function addStaleScriptIssues(
  issues: DiagnosticIssue[],
  root: string,
): Promise<void> {
  const names = [
    "env-read.sh",
    "destructive-shell.sh",
    "auto-format.sh",
    "workflow-check.sh",
    "sprint-open.sh",
    "session-context.sh",
    "sprint-size.sh",
  ];
  for (const name of names) {
    const path = join(root, ".cursor", "hooks", name);
    if (!(await fileExists(path))) continue;
    const content = (await readFileOrNull(path)) ?? "";
    const match = content.match(/lp-cursor-hook-version:\s*(\d+)/);
    if (match === null) continue;
    const version = Number.parseInt(match[1] ?? "", 10);
    if (Number.isNaN(version) || version >= CURSOR_HOOK_VERSION) continue;
    issues.push({
      analyzer: "Hooks",
      severity: "low",
      message: `stale Launchpad hook script: .cursor/hooks/${name}`,
      fix: "Run `claude-launchpad doctor --fix` to refresh Launchpad-owned hook scripts",
    });
  }
}
