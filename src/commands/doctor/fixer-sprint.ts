import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../../lib/output.js";
import { addHookToSettings } from "../../lib/hook-builder.js";
import {
  writeSprintHygieneScripts, writeWorkflowCheckScript,
  WORKFLOW_CHECK_WRAPPER, SPRINT_OPEN_WRAPPER, SPRINT_SIZE_WRAPPER,
  SESSION_START_MATCHER, SPRINT_COMPLETE_NUDGE,
} from "../../lib/hook-scripts.js";

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
    matcher: SESSION_START_MATCHER,
    hooks: [{ type: "command", command: SPRINT_SIZE_WRAPPER }],
  }, "Added sprint-size-check hook (warns on microsprint/oversized sprints)");
}

export async function addSprintOpenHook(root: string): Promise<boolean> {
  await writeSprintHygieneScripts(root);
  // PostToolUse, not PreToolUse: only PostToolUse can inject non-blocking context.
  return addHookToSettings(root, "PostToolUse", "sprint-open-check.sh", {
    matcher: "Bash",
    hooks: [{ type: "command", command: SPRINT_OPEN_WRAPPER }],
  }, "Added sprint-open-check hook (warns on WP pulls without BACKLOG cleanup)");
}

export async function addSprintCompleteNudge(root: string): Promise<boolean> {
  return addHookToSettings(root, "PostToolUse", "Sprint complete", {
    matcher: "Edit|Write",
    hooks: [{ type: "command", command: SPRINT_COMPLETE_NUDGE }],
  }, "Added sprint-complete nudge hook");
}

export async function addWorkflowCheckHook(root: string): Promise<boolean> {
  await writeWorkflowCheckScript(root);
  return addHookToSettings(root, "PostToolUse", "workflow-check.sh", {
    matcher: "Edit|Write",
    hooks: [{ type: "command", command: WORKFLOW_CHECK_WRAPPER }],
  }, "Added workflow-check hook (BACKLOG/TASKS staleness warnings)");
}
