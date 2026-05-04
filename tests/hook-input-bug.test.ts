/**
 * Regression test for the hook stdin input bug.
 *
 * Every PreToolUse / PostToolUse hook our CLI emits must read tool input
 * from stdin via `jq -r '.tool_input.X'`, NOT from $TOOL_INPUT_* env vars.
 * Claude Code does not set those env vars; reading them produces empty
 * strings and hooks silently no-op.
 */

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generateSettings } from "../src/commands/init/generators/settings.js";
import { hasEnvVarHookPattern } from "../src/lib/hook-input.js";
import {
  SPRINT_OPEN_CHECK,
  WORKFLOW_CHECK,
  SPRINT_SIZE_CHECK,
} from "../src/lib/hook-scripts.js";

const tsProject = {
  language: "TypeScript" as const,
  framework: null,
  packageManager: "pnpm" as const,
  buildTool: null,
  testFramework: null,
  rootDir: process.cwd(),
};

function flattenCommands(settings: ReturnType<typeof generateSettings>): string[] {
  const out: string[] = [];
  for (const groups of Object.values(settings.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks) {
        out.push(hook.command);
      }
    }
  }
  return out;
}

describe("hook input bug — generated commands", () => {
  it("init-generated settings.json has zero $TOOL_INPUT_* references", () => {
    const settings = generateSettings(tsProject);
    const offenders = flattenCommands(settings).filter(hasEnvVarHookPattern);
    expect(offenders).toEqual([]);
  });

  it("every PreToolUse hook command reads from stdin via jq", () => {
    const settings = generateSettings(tsProject);
    const preToolUse = settings.hooks?.PreToolUse ?? [];
    const inlineCommands = preToolUse
      .flatMap((g) => g.hooks.map((h) => h.command))
      .filter((c) => !c.includes(".claude/hooks/"));
    for (const cmd of inlineCommands) {
      expect(cmd).toMatch(/jq -r '\.tool_input\.(file_path|command)/);
    }
  });

  it("every PostToolUse hook command reads from stdin via jq", () => {
    const settings = generateSettings(tsProject);
    const postToolUse = settings.hooks?.PostToolUse ?? [];
    const inlineCommands = postToolUse
      .flatMap((g) => g.hooks.map((h) => h.command))
      .filter((c) => !c.includes(".claude/hooks/"));
    for (const cmd of inlineCommands) {
      expect(cmd).toMatch(/jq -r '\.tool_input\.(file_path|command)/);
    }
  });
});

describe("hook input bug — wrapper scripts", () => {
  it("SPRINT_OPEN_CHECK has zero $TOOL_INPUT_* references", () => {
    expect(hasEnvVarHookPattern(SPRINT_OPEN_CHECK)).toBe(false);
  });

  it("SPRINT_OPEN_CHECK reads command from stdin via jq", () => {
    expect(SPRINT_OPEN_CHECK).toMatch(/jq -r '\.tool_input\.command/);
  });

  it("WORKFLOW_CHECK has zero $TOOL_INPUT_* references", () => {
    expect(hasEnvVarHookPattern(WORKFLOW_CHECK)).toBe(false);
  });

  it("WORKFLOW_CHECK reads file_path from stdin via jq", () => {
    expect(WORKFLOW_CHECK).toMatch(/jq -r '\.tool_input\.file_path/);
  });

  it("SPRINT_SIZE_CHECK is unaffected (uses positional arg)", () => {
    expect(hasEnvVarHookPattern(SPRINT_SIZE_CHECK)).toBe(false);
  });
});

describe("hook input bug — wrapper script smoke tests", () => {
  it("workflow-check.sh fires on TASKS.md edit when fed JSON", () => {
    const tmp = mkdtempSync(join(tmpdir(), "lp-hook-smoke-"));
    try {
      writeFileSync(
        join(tmp, "TASKS.md"),
        "# Tasks\n## Current Sprint\n- [ ] WP-001\n## Session Log\n- **a**\n- **b**\n- **c**\n- **d**\n- **e**\n",
      );
      writeFileSync(join(tmp, "BACKLOG.md"), "# Backlog\n");
      const hooksDir = join(tmp, ".claude", "hooks");
      mkdirSync(hooksDir, { recursive: true });
      const scriptPath = join(hooksDir, "workflow-check.sh");
      writeFileSync(scriptPath, WORKFLOW_CHECK);
      chmodSync(scriptPath, 0o755);

      const fakeInput = JSON.stringify({ tool_input: { file_path: "TASKS.md" } });
      const output = execSync(
        `printf '%s' '${fakeInput}' | bash ${scriptPath}`,
        { cwd: tmp, encoding: "utf8" },
      );
      // 5 session log entries > 3 threshold
      expect(output).toMatch(/Session Log has 5 entries/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("workflow-check.sh stays silent for non-BACKLOG/TASKS file edits", () => {
    const tmp = mkdtempSync(join(tmpdir(), "lp-hook-smoke-"));
    try {
      const scriptPath = join(tmp, "workflow-check.sh");
      writeFileSync(scriptPath, WORKFLOW_CHECK);
      chmodSync(scriptPath, 0o755);

      const fakeInput = JSON.stringify({ tool_input: { file_path: "src/foo.ts" } });
      const output = execSync(
        `printf '%s' '${fakeInput}' | bash ${scriptPath}`,
        { cwd: tmp, encoding: "utf8" },
      );
      expect(output).toBe("");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
