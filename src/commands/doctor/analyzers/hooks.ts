import type {
  ClaudeConfig,
  AnalyzerResult,
  DiagnosticIssue,
} from "../../../types/index.js";
import { isJqAvailable } from "../../../lib/hook-input.js";
import { hasEnvVarHookPattern } from "../../../lib/hook-input.js";

export async function analyzeHooks(
  config: ClaudeConfig,
  projectRoot = "",
): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];
  const hooks = config.hooks;

  // Detect the hook stdin-input bug: hooks that read $TOOL_INPUT_* env vars never fire.
  // Claude Code passes hook context as JSON on stdin, not as env vars.
  for (const h of hooks) {
    if (h.command && hasEnvVarHookPattern(h.command)) {
      const preview = h.command.slice(0, 60).replace(/\s+/g, " ");
      issues.push({
        analyzer: "Hooks",
        severity: "high",
        message: `Hook reads non-existent $TOOL_INPUT_* env var (silently inert): ${h.event}/${h.matcher || "*"} — ${preview}…`,
        fix: "Run `doctor --fix` to rewrite known shapes to jq stdin form. User-customized hooks need manual rewrite to `jq -r '.tool_input.X' < /dev/stdin`.",
      });
    }
  }

  if (hooks.length === 0) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message:
        "No hooks configured — CLAUDE.md rules are advisory (~80% compliance), hooks are 100%",
      fix: "Add PostToolUse hooks for auto-formatting and PreToolUse for security gates",
    });
    return { name: "Hooks", issues, score: 30 };
  }

  // Outdated force-push pattern in the field (pre-v1.15): matched any command
  // containing "push" and a later -f token — blocked git stash push, greps, etc.
  const hasStaleForcePattern = config.hooks.some((h) =>
    h.command?.includes("push.*--force|push.*-f"),
  );
  if (hasStaleForcePattern) {
    issues.push({
      analyzer: "Hooks",
      severity: "low",
      message:
        "Force-push guard uses the outdated pattern — it false-positives on unrelated commands (git stash push, --frozen-lockfile, filenames)",
      fix: "Run `doctor --fix` to upgrade it to the anchored pattern",
    });
  }

  // Check for auto-format hook (prettier, ruff, gofmt, rustfmt, etc.)
  const formatPatterns = [
    "format",
    "prettier",
    "gofmt",
    "rustfmt",
    "rubocop",
    "pint",
    "ktlint",
    "swift-format",
    "dotnet format",
  ];
  const hasPostFormat = hooks.some(
    (h) =>
      h.event === "PostToolUse" &&
      h.matcher?.includes("Write") &&
      formatPatterns.some((p) => h.command?.includes(p)),
  );
  if (!hasPostFormat) {
    issues.push({
      analyzer: "Hooks",
      severity: "low",
      message: "No auto-format hook found",
      fix: "Add a PostToolUse hook that runs your formatter on Write|Edit",
    });
  }

  // Check for security gate (env file protection)
  const hasEnvProtection = hooks.some(
    (h) => h.event === "PreToolUse" && h.command?.includes(".env"),
  );
  if (!hasEnvProtection) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message:
        "No .env file protection hook — Claude could read or write secrets in .env files",
      fix: "Add a PreToolUse hook on Read|Write|Edit that blocks access to .env files",
    });
  }

  // Check for PreToolUse hooks (security layer)
  const hasPreToolUse = hooks.some((h) => h.event === "PreToolUse");
  if (!hasPreToolUse) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message: "No PreToolUse hooks — this is your security enforcement layer",
      fix: "Add PreToolUse hooks for file protection and dangerous command blocking",
    });
  }

  // Environment preflight: every generated hook parses stdin via jq. Without
  // it the whole enforcement layer — including the blocking security guards —
  // silently no-ops. The exact Sprint 32 failure class, as a dependency.
  const usesJq = hooks.some((h) => h.command?.includes("jq "));
  if (usesJq && !isJqAvailable()) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message:
        "jq not found on PATH — every generated hook (including the .env and destructive-command guards) silently no-ops without it",
      fix: "Install jq (https://jqlang.github.io/jq/download/) — hooks read tool input as JSON from stdin",
    });
  }

  // PostCompact exists but is a side-effect event: its stdout is never injected
  // into context. A TASKS.md re-injection registered there silently does nothing.
  const hasInertPostCompact = hooks.some(
    (h) =>
      h.event === "PostCompact" &&
      !!h.command &&
      h.command.includes("TASKS.md"),
  );
  if (hasInertPostCompact) {
    issues.push({
      analyzer: "Hooks",
      severity: "high",
      message:
        "PostCompact hooks can't inject context — this TASKS.md re-injection never reaches the model. Session continuity after compaction is silently broken",
      fix: "Run `doctor --fix` to move the injection to a SessionStart hook with a compact matcher",
    });
  }

  // Session continuity across compaction: SessionStart matcher must include
  // `compact` (an empty/absent matcher matches all sources, which also counts).
  const hasCompactMatcher = hooks.some(
    (h) =>
      h.event === "SessionStart" &&
      ((h.matcher ?? "") === "" || (h.matcher ?? "").includes("compact")),
  );
  if (!hasCompactMatcher) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message:
        "No SessionStart hook with a compact matcher — session context is lost when the conversation is compacted",
      fix: "Run `doctor --fix` to widen the SessionStart matcher to startup|resume|compact|clear",
    });
  }

  // Check for SessionStart hook
  const hasSessionStart = hooks.some((h) => h.event === "SessionStart");
  if (!hasSessionStart) {
    issues.push({
      analyzer: "Hooks",
      severity: "low",
      message:
        "No SessionStart hook — session starts without project context loaded",
      fix: "Add a SessionStart hook that injects TASKS.md at startup",
    });
  }

  // Sprint workflow hygiene — only relevant when the project uses TASKS.md
  const usesTasksMd = hooks.some((h) => h.command?.includes("TASKS.md"));
  if (usesTasksMd) {
    if (!hooks.some((h) => h.command?.includes("sprint-size-check.sh"))) {
      issues.push({
        analyzer: "Hooks",
        severity: "low",
        message:
          "No sprint-size-check hook — sprints aren't enforced for size (sweet spot 3-6 work packages)",
        fix: "Add SessionStart hook calling .claude/hooks/sprint-size-check.sh",
      });
    }
    if (!hooks.some((h) => h.command?.includes("sprint-open-check.sh"))) {
      issues.push({
        analyzer: "Hooks",
        severity: "low",
        message:
          "No sprint-open-check hook — opening a new sprint without removing pulled WPs from BACKLOG silently drifts",
        fix: "Add PostToolUse Bash hook calling .claude/hooks/sprint-open-check.sh",
      });
    }
    if (!hooks.some((h) => h.command?.includes("Sprint complete"))) {
      issues.push({
        analyzer: "Hooks",
        severity: "low",
        message:
          "No sprint-complete nudge — finishing all sprint tasks goes unnoticed",
        fix: "Add PostToolUse hook that nudges when all current-sprint checkboxes flip to [x]",
      });
    }
    if (!hooks.some((h) => h.command?.includes("workflow-check.sh"))) {
      issues.push({
        analyzer: "Hooks",
        severity: "low",
        message:
          "No workflow-check.sh hook — BACKLOG/TASKS staleness (duplicate WP IDs, oversized sprint, long session log) is unmonitored",
        fix: "Add PostToolUse Edit|Write hook calling .claude/hooks/workflow-check.sh",
      });
    }
  }

  // Pre-v1.12 shapes still in the field: warnings that never reach the model.
  const sprintOpenOnPreToolUse = hooks.some(
    (h) =>
      h.event === "PreToolUse" &&
      !!h.command &&
      h.command.includes("sprint-open-check.sh"),
  );
  if (sprintOpenOnPreToolUse) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message:
        "sprint-open-check.sh is registered on PreToolUse — context injection is impossible there and the current script inspects the last commit. It belongs on PostToolUse",
      fix: "Run `doctor --fix` to move it to PostToolUse and refresh the script",
    });
  }
  const staleEchoNudge = hooks.some(
    (h) =>
      !!h.command &&
      h.command.includes("Sprint complete") &&
      !h.command.includes("additionalContext"),
  );
  if (staleEchoNudge) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message:
        "sprint-complete nudge uses bare stdout — PostToolUse stdout never reaches the model, so the nudge is invisible",
      fix: "Run `doctor --fix` to upgrade it to additionalContext JSON",
    });
  }

  // On-disk hygiene scripts from before v1.12 print bare stdout — invisible.
  if (projectRoot !== "" && (await hasStaleHygieneScript(projectRoot))) {
    issues.push({
      analyzer: "Hooks",
      severity: "medium",
      message:
        "Outdated hygiene script(s) in .claude/hooks — their warnings use bare stdout and never reach the model",
      fix: "Run `doctor --fix` to refresh workflow-check.sh / sprint-open-check.sh",
    });
  }

  const score = Math.max(0, 100 - issues.length * 15);
  return { name: "Hooks", issues, score };
}

/** workflow-check + sprint-open must emit additionalContext JSON to be visible. */
async function hasStaleHygieneScript(projectRoot: string): Promise<boolean> {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  for (const name of ["workflow-check.sh", "sprint-open-check.sh"]) {
    const content = await readFile(
      join(projectRoot, ".claude", "hooks", name),
      "utf-8",
    ).catch(() => null);
    if (content !== null && !content.includes("hookSpecificOutput"))
      return true;
  }
  return false;
}
