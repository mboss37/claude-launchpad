import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../../lib/output.js";
import { addHookToSettings } from "../../lib/hook-builder.js";
import { readSettingsJson, writeSettingsJson } from "../../lib/settings.js";
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

/** Pre-v1.12: sprint-open-check ran on PreToolUse, where context injection is impossible. */
export async function migrateSprintOpenHookEvent(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  if (settings === null) return false;
  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;

  const preToolUse = (hooks.PreToolUse ?? []) as Record<string, unknown>[];
  let removed = false;
  const cleaned = preToolUse
    .map((group) => {
      const nested = (group.hooks ?? []) as Record<string, unknown>[];
      const filtered = nested.filter((h) => !String(h.command ?? "").includes("sprint-open-check.sh"));
      if (filtered.length !== nested.length) removed = true;
      return { ...group, hooks: filtered };
    })
    .filter((group) => (group.hooks as unknown[]).length > 0);
  if (!removed) return false;

  await writeSettingsJson(root, { ...settings, hooks: { ...hooks, PreToolUse: cleaned as unknown[] } });
  await writeSprintHygieneScripts(root);
  await addSprintOpenHook(root);
  log.success("Moved sprint-open-check to PostToolUse (context injection is impossible on PreToolUse)");
  return true;
}

/** Pre-v1.12: the sprint-complete nudge echoed to stdout, which the model never sees. */
export async function upgradeStaleNudge(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  if (settings === null) return false;
  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;

  let changed = false;
  const upgraded = Object.fromEntries(Object.entries(hooks).map(([event, groups]) => [
    event,
    (groups as Record<string, unknown>[]).map((group) => ({
      ...group,
      hooks: ((group.hooks ?? []) as Record<string, unknown>[]).map((h) => {
        const cmd = String(h.command ?? "");
        if (cmd.includes("Sprint complete") && !cmd.includes("additionalContext")) {
          changed = true;
          return { ...h, command: SPRINT_COMPLETE_NUDGE };
        }
        return h;
      }),
    })),
  ]));
  if (!changed) return false;

  await writeSettingsJson(root, { ...settings, hooks: upgraded });
  log.success("Upgraded sprint-complete nudge to additionalContext JSON (was invisible bare stdout)");
  return true;
}

/** Rewrite pre-v1.12 hygiene scripts whose warnings never reached the model. */
export async function refreshHygieneScripts(root: string): Promise<boolean> {
  const scripts = [".claude/hooks/workflow-check.sh", ".claude/hooks/sprint-open-check.sh"];
  let stale = false;
  for (const rel of scripts) {
    const content = await readFile(join(root, rel), "utf-8").catch(() => null);
    if (content !== null && !content.includes("hookSpecificOutput")) stale = true;
  }
  if (!stale) return false;

  await writeSprintHygieneScripts(root);
  await writeWorkflowCheckScript(root);
  log.success("Refreshed hygiene scripts (warnings now emitted as additionalContext JSON)");
  return true;
}
