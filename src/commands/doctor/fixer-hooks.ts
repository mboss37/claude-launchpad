import { addHookToSettings } from "../../lib/hook-builder.js";
import { readSettingsJson, writeSettingsJson } from "../../lib/settings.js";
import { log } from "../../lib/output.js";
import { SESSION_START_MATCHER } from "../../lib/hook-scripts.js";
import { jqField } from "../../lib/hook-input.js";
import type { DetectedProject } from "../../types/index.js";

const FORMATTERS: Record<string, { extensions: string[]; command: string }> = {
  TypeScript: { extensions: ["ts", "tsx"], command: "npx prettier --write" },
  JavaScript: { extensions: ["js", "jsx"], command: "npx prettier --write" },
  Python: { extensions: ["py"], command: "ruff format" },
  Go: { extensions: ["go"], command: "gofmt -w" },
  Rust: { extensions: ["rs"], command: "rustfmt" },
  Ruby: { extensions: ["rb"], command: "rubocop -A" },
  PHP: { extensions: ["php"], command: "vendor/bin/pint" },
};

export async function addEnvProtectionHook(root: string): Promise<boolean> {
  return addHookToSettings(root, "PreToolUse", ".env", {
    matcher: "Read|Write|Edit",
    hooks: [{
      type: "command",
      command: `fp=${jqField("file_path")}; echo "$fp" | grep -qE '\\.(env|env\\..*)$' && ! echo "$fp" | grep -q '.env.example' && { echo 'BLOCKED: .env files contain secrets' >&2; exit 2; }; exit 0`,
    }],
  }, "Added .env file protection hook (PreToolUse)");
}

export async function addAutoFormatHook(root: string, detected: DetectedProject): Promise<boolean> {
  if (!detected.language) return false;
  const config = detected.language ? FORMATTERS[detected.language] : null;
  if (!config) return false;

  const extChecks = config.extensions.map((ext) => `[ "$ext" = "${ext}" ]`).join(" || ");
  return addHookToSettings(root, "PostToolUse", "format", {
    matcher: "Write|Edit",
    hooks: [{
      type: "command",
      command: `fp=${jqField("file_path")}; ext="\${fp##*.}"; (${extChecks}) && ${config.command} "$fp" 2>/dev/null; exit 0`,
    }],
  }, `Added auto-format hook (PostToolUse → ${config.command})`);
}

export async function addForcePushProtection(root: string): Promise<boolean> {
  return addHookToSettings(root, "PreToolUse", "force", {
    matcher: "Bash",
    hooks: [{
      type: "command",
      command: `cmd=${jqField("command")}; echo "$cmd" | grep -qE 'push.*--force|push.*-f' && { echo 'WARNING: Force push detected — this can destroy remote history' >&2; exit 2; }; exit 0`,
    }],
  }, "Added force-push protection hook (PreToolUse → Bash)");
}

/**
 * PostCompact is not a Claude Code hook event — hooks registered under it
 * never fire. Migration: delete the dead PostCompact block and make sure a
 * SessionStart entry covers the real compact/clear matchers instead.
 */
export async function migratePostCompactHook(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  if (settings === null) return false;
  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;

  let changed = false;
  const { PostCompact: _dead, ...rest } = hooks;
  if (_dead !== undefined) changed = true;

  const withMatcher = ensureCompactMatcher(rest as Record<string, unknown[]>);
  if (withMatcher.changed) changed = true;
  if (!changed) return false;

  await writeSettingsJson(root, { ...settings, hooks: withMatcher.hooks });
  log.success("Migrated dead PostCompact hook → SessionStart compact/clear matcher");
  return true;
}

export async function addCompactMatcherHook(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  if (settings === null) return false;
  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  const result = ensureCompactMatcher(hooks);
  if (!result.changed) return false;
  await writeSettingsJson(root, { ...settings, hooks: result.hooks });
  log.success("SessionStart matcher now covers compact/clear (session continuity after compaction)");
  return true;
}

/** Widen the TASKS.md-injecting SessionStart entry's matcher to include compact/clear. */
function ensureCompactMatcher(
  hooks: Record<string, unknown[]>,
): { hooks: Record<string, unknown[]>; changed: boolean } {
  const sessionStart = (hooks.SessionStart ?? []) as Record<string, unknown>[];
  if (sessionStart.some((g) => String(g.matcher ?? "").includes("compact"))) {
    return { hooks, changed: false };
  }
  const idx = sessionStart.findIndex((g) => {
    const nested = g.hooks as Record<string, unknown>[] | undefined;
    return nested?.some((h) => String(h.command ?? "").includes("TASKS.md"));
  });
  if (idx === -1) {
    // No TASKS.md SessionStart hook to widen — add the canonical one.
    const entry = { matcher: SESSION_START_MATCHER, hooks: [{ type: "command", command: "cat TASKS.md 2>/dev/null; exit 0" }] };
    return { hooks: { ...hooks, SessionStart: [...sessionStart, entry] }, changed: true };
  }
  const widened = sessionStart.map((g, i) => (i === idx ? { ...g, matcher: SESSION_START_MATCHER } : g));
  return { hooks: { ...hooks, SessionStart: widened }, changed: true };
}

export async function addSessionStartHook(root: string): Promise<boolean> {
  return addHookToSettings(root, "SessionStart", "TASKS.md", {
    matcher: SESSION_START_MATCHER,
    hooks: [{ type: "command", command: "cat TASKS.md 2>/dev/null; exit 0" }],
  }, "Added SessionStart hook (injects TASKS.md at startup/resume/compact/clear)");
}
