import { describe, it, expect } from "vitest";
import { analyzeHooks } from "../src/commands/doctor/analyzers/hooks.js";
import type { ClaudeConfig, HookConfig } from "../src/types/index.js";

function makeConfig(hooks: HookConfig[] = []): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: "# Test",
    claudeMdInstructionCount: 10,
    settingsPath: null,
    settings: null,
    localClaudeMdContent: null,
    localSettings: null,
    hooks,
    rules: [],
    mcpServers: [],
    skills: [],
    claudeignorePath: null,
    claudeignoreContent: null,
    worktreeIncludePath: null,
    worktreeIncludeContent: null,
    gitWorktreesActive: false,
  };
}

describe("analyzeHooks", () => {
  it("scores 30 when no hooks configured", async () => {
    const result = await analyzeHooks(makeConfig());
    expect(result.score).toBe(30);
    expect(result.issues[0].severity).toBe("medium");
  });

  it("scores 100 with all hook types present", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PostToolUse", type: "command", matcher: "Write|Edit", command: "prettier --write $FILE" },
      { event: "PreToolUse", type: "command", matcher: "Read|Write", command: "check .env files" },
      { event: "PostCompact", type: "command", matcher: "", command: "cat TASKS.md" },
      { event: "SessionStart", type: "command", matcher: "startup", command: "cat TASKS.md" },
      { event: "SessionStart", type: "command", matcher: "startup|resume", command: "bash .claude/hooks/sprint-size-check.sh TASKS.md" },
      { event: "PreToolUse", type: "command", matcher: "Bash", command: "bash .claude/hooks/sprint-open-check.sh" },
      { event: "PostToolUse", type: "command", matcher: "Edit|Write", command: "echo 'Sprint complete — all current tasks done'" },
      { event: "PostToolUse", type: "command", matcher: "Edit|Write", command: "bash .claude/hooks/workflow-check.sh" },
    ]));
    expect(result.score).toBe(100);
  });

  it("flags missing workflow-check hook when TASKS.md is used", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "SessionStart", type: "command", matcher: "startup", command: "cat TASKS.md" },
    ]));
    expect(result.issues.some((i) => i.message.includes("workflow-check.sh"))).toBe(true);
  });

  it("flags missing auto-format hook", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PreToolUse", type: "command", matcher: "Write", command: "block .env" },
    ]));
    expect(result.issues.some((i) => i.message.includes("auto-format"))).toBe(true);
  });

  it("flags missing .env protection", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PostToolUse", type: "command", matcher: "Write|Edit", command: "prettier --write" },
    ]));
    expect(result.issues.some((i) => i.message.includes(".env"))).toBe(true);
  });

  it("does not flag SessionEnd (handled by memory analyzer)", async () => {
    const result = await analyzeHooks(makeConfig([
      { event: "PreToolUse", type: "command", command: ".env block" },
    ]));
    expect(result.issues.some((i) => i.message.includes("SessionEnd"))).toBe(false);
  });

  it("recognizes various formatter names", async () => {
    const formatters = ["prettier", "gofmt", "rustfmt", "rubocop", "pint"];
    for (const fmt of formatters) {
      const result = await analyzeHooks(makeConfig([
        { event: "PostToolUse", type: "command", matcher: "Write|Edit", command: `${fmt} $FILE` },
        { event: "PreToolUse", type: "command", matcher: "Write", command: ".env block" },
      ]));
      expect(result.issues.some((i) => i.message.includes("auto-format"))).toBe(false);
    }
  });

  describe("env-var hook bug detection", () => {
    it("flags HIGH when a hook command reads $TOOL_INPUT_FILE_PATH (silent inert hook)", async () => {
      const result = await analyzeHooks(makeConfig([
        { event: "PreToolUse", type: "command", matcher: "Read|Write|Edit",
          command: 'echo "$TOOL_INPUT_FILE_PATH" | grep -q TASKS.md; exit 0' },
      ]));
      const finding = result.issues.find((i) => i.message.includes("$TOOL_INPUT"));
      expect(finding).toBeDefined();
      expect(finding?.severity).toBe("high");
    });

    it("flags HIGH for ${TOOL_INPUT_COMMAND} pattern in PostToolUse", async () => {
      const result = await analyzeHooks(makeConfig([
        { event: "PostToolUse", type: "command", matcher: "Bash",
          command: 'cmd="${TOOL_INPUT_COMMAND:-}"; echo "$cmd"; exit 0' },
      ]));
      expect(result.issues.some((i) => i.severity === "high" && i.message.includes("$TOOL_INPUT"))).toBe(true);
    });

    it("does NOT flag jq-stdin-based hooks (the canonical form)", async () => {
      const result = await analyzeHooks(makeConfig([
        { event: "PreToolUse", type: "command", matcher: "Bash",
          command: `cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null); echo "$cmd"; exit 0` },
      ]));
      expect(result.issues.some((i) => i.message.includes("$TOOL_INPUT"))).toBe(false);
    });

    it("flags every offending hook even when there are multiple", async () => {
      const result = await analyzeHooks(makeConfig([
        { event: "PreToolUse", type: "command", matcher: "Read", command: 'echo "$TOOL_INPUT_FILE_PATH"; exit 0' },
        { event: "PostToolUse", type: "command", matcher: "Bash", command: 'echo "$TOOL_INPUT_COMMAND"; exit 0' },
      ]));
      const findings = result.issues.filter((i) => i.message.includes("$TOOL_INPUT"));
      expect(findings.length).toBeGreaterThanOrEqual(2);
    });
  });
});
