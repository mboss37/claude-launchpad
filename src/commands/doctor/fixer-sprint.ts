import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../../lib/output.js";
import { addHookToSettings } from "../../lib/hook-builder.js";
import { jqField } from "../../lib/hook-input.js";
import { writeSprintHygieneScripts, writeWorkflowCheckScript } from "../../lib/hook-scripts.js";

const WORKTREE_INCLUDE_TEMPLATE = `# Files copied into git worktrees that Claude Code creates for subagents.
# Listed files must be gitignored — that's the point: keep secrets out of
# commits while letting worktree subagents inherit local env so dev servers,
# tests, and integration runs work the same as the main tree.
# Anything needed by \`pnpm dev\`, \`pnpm test\`, etc. that's NOT committed
# should land here.

.env.local
.env
`;

export async function createWorktreeInclude(root: string): Promise<boolean> {
  await writeFile(join(root, ".worktreeinclude"), WORKTREE_INCLUDE_TEMPLATE);
  log.success("Generated .worktreeinclude (worktree subagents inherit .env.local / .env)");
  return true;
}

export async function addSprintSizeHook(root: string): Promise<boolean> {
  await writeSprintHygieneScripts(root);
  return addHookToSettings(root, "SessionStart", "sprint-size-check.sh", {
    matcher: "startup|resume",
    hooks: [{ type: "command", command: "bash .claude/hooks/sprint-size-check.sh TASKS.md 2>/dev/null; exit 0" }],
  }, "Added sprint-size-check hook (warns on microsprint/oversized sprints)");
}

export async function addSprintOpenHook(root: string): Promise<boolean> {
  await writeSprintHygieneScripts(root);
  return addHookToSettings(root, "PreToolUse", "sprint-open-check.sh", {
    matcher: "Bash",
    hooks: [{ type: "command", command: "bash .claude/hooks/sprint-open-check.sh 2>/dev/null; exit 0" }],
  }, "Added sprint-open-check hook (warns on new sprint without BACKLOG cleanup)");
}

export async function addSprintCompleteNudge(root: string): Promise<boolean> {
  return addHookToSettings(root, "PostToolUse", "Sprint complete", {
    matcher: "Edit|Write",
    hooks: [{
      type: "command",
      command: `fp=${jqField("file_path")}; echo "$fp" | grep -q TASKS.md || exit 0; section=$(sed -n '/^## Current/,/^## /p' TASKS.md 2>/dev/null); [ -z "$section" ] && exit 0; unchecked=$(echo "$section" | grep -cF '- [ ]' || true); checked=$(echo "$section" | grep -cF '- [x]' || true); [ "$unchecked" -eq 0 ] && [ "$checked" -gt 0 ] && echo 'Sprint complete — all current tasks done. Consider a quick quality check before committing: scan for dead code, debug artifacts, TODO hacks, and convention violations. Run tests if available. Skip if trivial.'; exit 0`,
    }],
  }, "Added sprint-complete nudge hook");
}

export async function addWorkflowCheckHook(root: string): Promise<boolean> {
  await writeWorkflowCheckScript(root);
  return addHookToSettings(root, "PostToolUse", "workflow-check.sh", {
    matcher: "Edit|Write",
    hooks: [{ type: "command", command: "bash .claude/hooks/workflow-check.sh 2>/dev/null; exit 0" }],
  }, "Added workflow-check hook (BACKLOG/TASKS staleness warnings)");
}
