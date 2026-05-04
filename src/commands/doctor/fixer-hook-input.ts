import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../../lib/output.js";
import { hasEnvVarHookPattern, jqField } from "../../lib/hook-input.js";
import { readSettingsJson, writeSettingsJson } from "../../lib/settings.js";
import {
  writeWorkflowCheckScript,
  writeSprintHygieneScripts,
} from "../../lib/hook-scripts.js";

interface HookEntry {
  readonly type: "command";
  readonly command: string;
}

interface HookGroup {
  readonly matcher?: string;
  readonly hooks: ReadonlyArray<HookEntry>;
}

/**
 * Rewrite an inert hook command (one that reads $TOOL_INPUT_* env vars) to the
 * canonical jq+stdin form. Returns null when the shape is unrecognized so the
 * caller can leave user customizations alone (the analyzer still warns).
 *
 * "Rewrite" means "replace with the current canonical shape". This may include
 * additional defensive guards the user did not have (e.g. `.env.example`
 * exclusion) — the canonical shape is the source of truth, not the input.
 */
export function rewriteEnvVarHookCommand(cmd: string): string | null {
  // Defense-in-depth: this function is gated upstream, but a direct caller
  // should never get back a "rewritten" version of a clean command.
  if (!hasEnvVarHookPattern(cmd)) return null;

  // .env file block (PreToolUse Read|Write|Edit)
  if (cmd.includes("BLOCKED: .env files contain secrets")) {
    return `fp=${jqField("file_path")}; echo "$fp" | grep -qE '\\.(env|env\\..*)$' && ! echo "$fp" | grep -q '.env.example' && { echo 'BLOCKED: .env files contain secrets' >&2; exit 2; }; exit 0`;
  }

  // Destructive bash block (PreToolUse Bash)
  if (cmd.includes("BLOCKED: Destructive command detected")) {
    return `cmd=${jqField("command")}; echo "$cmd" | grep -qE 'rm\\s+-rf\\s+/|DROP\\s+TABLE|DROP\\s+DATABASE|push.*--force|push.*-f' && { echo 'BLOCKED: Destructive command detected' >&2; exit 2; }; exit 0`;
  }

  // Force-push warning (PreToolUse Bash)
  if (cmd.includes("WARNING: Force push detected") || cmd.includes("Force push detected")) {
    return `cmd=${jqField("command")}; echo "$cmd" | grep -qE 'push.*--force|push.*-f' && { echo 'WARNING: Force push detected — this can destroy remote history' >&2; exit 2; }; exit 0`;
  }

  // Sprint-complete nudge (PostToolUse Edit|Write)
  if (cmd.includes("Sprint complete") && cmd.includes("TASKS.md")) {
    return `fp=${jqField("file_path")}; echo "$fp" | grep -q TASKS.md || exit 0; section=$(sed -n '/^## Current/,/^## /p' TASKS.md 2>/dev/null); [ -z "$section" ] && exit 0; unchecked=$(echo "$section" | grep -cF '- [ ]' || true); checked=$(echo "$section" | grep -cF '- [x]' || true); [ "$unchecked" -eq 0 ] && [ "$checked" -gt 0 ] && echo 'Sprint complete — all current tasks done. Consider a quick quality check before committing: scan for dead code, debug artifacts, TODO hacks, and convention violations. Run tests if available. Skip if trivial.'; exit 0`;
  }

  // Auto-format hook (PostToolUse Write|Edit) — extract formatter + extension list from the original
  // Original shape: ext=${TOOL_INPUT_FILE_PATH##*.}; ([ "$ext" = "ts" ] || [ "$ext" = "tsx" ]) && npx prettier --write "$TOOL_INPUT_FILE_PATH" 2>/dev/null; exit 0
  const formatMatch = cmd.match(/ext=\$\{TOOL_INPUT_FILE_PATH##\*\.\};\s*\((.+?)\)\s*&&\s*(.+?)\s*"\$TOOL_INPUT_FILE_PATH"/);
  if (formatMatch) {
    const extChecks = formatMatch[1].trim();
    const formatter = formatMatch[2].trim();
    return `fp=${jqField("file_path")}; ext="\${fp##*.}"; (${extChecks}) && ${formatter} "$fp" 2>/dev/null; exit 0`;
  }

  return null;
}

interface RewriteOutcome {
  readonly settings: Record<string, unknown>;
  readonly changed: boolean;
}

function rewriteSettingsHooks(settings: Record<string, unknown>): RewriteOutcome {
  const hooks = settings.hooks as Record<string, ReadonlyArray<HookGroup>> | undefined;
  if (!hooks) return { settings, changed: false };

  let changed = false;
  const next: Record<string, ReadonlyArray<HookGroup>> = {};

  for (const [event, groups] of Object.entries(hooks)) {
    next[event] = groups.map((group) => ({
      ...group,
      hooks: group.hooks.map((hook) => {
        if (hook.type !== "command") return hook;
        if (!hasEnvVarHookPattern(hook.command)) return hook;
        const rewritten = rewriteEnvVarHookCommand(hook.command);
        if (rewritten === null) return hook;
        changed = true;
        return { ...hook, command: rewritten };
      }),
    }));
  }

  if (!changed) return { settings, changed: false };
  return { settings: { ...settings, hooks: next }, changed: true };
}

async function rewriteWrapperScript(
  scriptPath: string,
  rewriter: () => Promise<unknown>,
): Promise<boolean> {
  let content: string;
  try {
    content = await readFile(scriptPath, "utf-8");
  } catch {
    return false;
  }
  if (!hasEnvVarHookPattern(content)) return false;
  await rewriter();
  return true;
}

/**
 * Detect and rewrite the hook stdin-input bug:
 *   1. Inline hook commands in settings.json that read $TOOL_INPUT_* env vars
 *   2. Wrapper scripts (workflow-check.sh, sprint-open-check.sh) that do the same
 *
 * Known shapes (the hooks we generate) are rewritten to the canonical jq+stdin
 * form. User-customized hooks with the same env-var pattern are left alone —
 * the analyzer's HIGH finding still surfaces them so the user can fix manually.
 */
export async function rewriteEnvVarHooks(root: string): Promise<boolean> {
  let didFix = false;

  // 1. Inline commands in settings.json
  const settings = await readSettingsJson(root);
  if (settings !== null) {
    const outcome = rewriteSettingsHooks(settings as Record<string, unknown>);
    if (outcome.changed) {
      await writeSettingsJson(root, outcome.settings);
      log.success("Rewrote inert $TOOL_INPUT_* hooks in settings.json to canonical jq+stdin form");
      didFix = true;
    }
  }

  // 2. workflow-check.sh wrapper script
  const workflowCheckPath = join(root, ".claude", "hooks", "workflow-check.sh");
  if (await rewriteWrapperScript(workflowCheckPath, () => writeWorkflowCheckScript(root))) {
    log.success("Rewrote .claude/hooks/workflow-check.sh to canonical jq+stdin form");
    didFix = true;
  }

  // 3. sprint-open-check.sh wrapper script (writeSprintHygieneScripts re-writes both
  //    sprint-size and sprint-open; sprint-size has no bug so re-writing is harmless)
  const sprintOpenPath = join(root, ".claude", "hooks", "sprint-open-check.sh");
  if (await rewriteWrapperScript(sprintOpenPath, () => writeSprintHygieneScripts(root))) {
    log.success("Rewrote .claude/hooks/sprint-open-check.sh to canonical jq+stdin form");
    didFix = true;
  }

  return didFix;
}
