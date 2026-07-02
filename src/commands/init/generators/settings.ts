import type { DetectedProject } from "../../../types/index.js";
import { jqField } from "../../../lib/hook-input.js";
import {
  WORKFLOW_CHECK_WRAPPER, SPRINT_OPEN_WRAPPER, SPRINT_SIZE_WRAPPER, SESSION_START_MATCHER,
  SPRINT_COMPLETE_NUDGE,
} from "../../../lib/hook-scripts.js";

interface HookEntry {
  readonly type: "command";
  readonly command: string;
}

interface HookGroup {
  readonly matcher: string;
  readonly hooks: ReadonlyArray<HookEntry>;
}

interface ClaudeSettings {
  readonly $schema?: string;
  readonly permissions?: {
    readonly deny?: ReadonlyArray<string>;
  };
  readonly hooks?: Record<string, ReadonlyArray<HookGroup>>;
  readonly disableBypassPermissionsMode?: "disable";
}

/**
 * Generate .claude/settings.json based on detected project.
 * Includes: schema for IDE autocomplete, security deny-lists, hooks.
 */
export function generateSettings(detected: DetectedProject): ClaudeSettings {
  const preToolUse: HookGroup[] = [];
  const postToolUse: HookGroup[] = [];

  // Universal: .env file protection (block read + write)
  preToolUse.push({
    matcher: "Read|Write|Edit",
    hooks: [{
      type: "command",
      command: `fp=${jqField("file_path")}; echo "$fp" | grep -qE '\\.(env|env\\..*)$' && ! echo "$fp" | grep -q '.env.example' && { echo 'BLOCKED: .env files contain secrets' >&2; exit 2; }; exit 0`,
    }],
  });

  // Universal: block destructive commands
  preToolUse.push({
    matcher: "Bash",
    hooks: [{
      type: "command",
      command: `cmd=${jqField("command")}; echo "$cmd" | grep -qE 'rm\\s+-rf\\s+/|DROP\\s+TABLE|DROP\\s+DATABASE|push.*--force|push.*-f' && { echo 'BLOCKED: Destructive command detected' >&2; exit 2; }; exit 0`,
    }],
  });

  // One "Edit|Write" PostToolUse entry holds format + nudge + workflow-check:
  // multiple top-level entries with the same matcher are undefined behavior
  // (our own hooks.md rule) — same-matcher hooks share one entry's array.
  const editWriteHooks: HookEntry[] = [];
  const formatHook = buildFormatHook(detected);
  if (formatHook) {
    editWriteHooks.push(formatHook);
  }

  // Sprint review: nudge when all current sprint tasks are complete.
  // Emitted as additionalContext JSON — bare PostToolUse stdout never reaches the model.
  editWriteHooks.push({
    type: "command",
    command: SPRINT_COMPLETE_NUDGE,
  });

  // Workflow discipline: warn on BACKLOG/TASKS drift (duplicate WP entries, oversized sprint, long session log, dependency-blind pulls)
  editWriteHooks.push({
    type: "command",
    command: WORKFLOW_CHECK_WRAPPER,
  });

  postToolUse.push({ matcher: "Edit|Write", hooks: editWriteHooks });

  // Sprint-open hygiene: after `git commit`, warn if WPs were pulled without BACKLOG deletions.
  // PostToolUse (not PreToolUse): only PostToolUse can inject non-blocking context.
  postToolUse.push({
    matcher: "Bash",
    hooks: [{
      type: "command",
      command: SPRINT_OPEN_WRAPPER,
    }],
  });

  // SessionStart: inject TASKS.md + sprint-size check. Matcher includes
  // compact/clear so session continuity survives compaction — there is no
  // PostCompact hook event in Claude Code.
  const sessionStart: HookGroup[] = [{
    matcher: SESSION_START_MATCHER,
    hooks: [{
      type: "command",
      command: "cat TASKS.md 2>/dev/null; exit 0",
    }, {
      type: "command",
      command: SPRINT_SIZE_WRAPPER,
    }],
  }];

  const hooks: Record<string, ReadonlyArray<HookGroup>> = {};
  hooks.SessionStart = sessionStart;
  if (preToolUse.length > 0) hooks.PreToolUse = preToolUse;
  if (postToolUse.length > 0) hooks.PostToolUse = postToolUse;

  return {
    $schema: "https://json.schemastore.org/claude-code-settings.json",
    permissions: {
      deny: [
        "Bash(rm -rf /)",
        "Bash(rm -rf ~)",
        "Read(.env)",
        "Read(.env.*)",
        "Read(secrets/**)",
        "Read(~/.ssh/*)",
        "Read(~/.aws/*)",
        "Read(~/.npmrc)",
      ],
    },
    hooks,
    disableBypassPermissionsMode: "disable",
  };
}

// Safe formatter commands - never interpolate user-controlled strings
const SAFE_FORMATTERS: Record<string, { extensions: string[]; command: string }> = {
  TypeScript: { extensions: ["ts", "tsx"], command: "npx prettier --write" },
  JavaScript: { extensions: ["js", "jsx"], command: "npx prettier --write" },
  Python: { extensions: ["py"], command: "ruff format" },
  Go: { extensions: ["go"], command: "gofmt -w" },
  Rust: { extensions: ["rs"], command: "rustfmt" },
  Ruby: { extensions: ["rb"], command: "rubocop -A" },
  Dart: { extensions: ["dart"], command: "dart format" },
  PHP: { extensions: ["php"], command: "vendor/bin/pint" },
  Kotlin: { extensions: ["kt", "kts"], command: "ktlint -F" },
  Java: { extensions: ["java"], command: "google-java-format -i" },
  Swift: { extensions: ["swift"], command: "swift-format format -i" },
  Elixir: { extensions: ["ex", "exs"], command: "mix format" },
  "C#": { extensions: ["cs"], command: "dotnet format" },
};

function buildFormatHook(detected: DetectedProject): HookEntry | null {
  if (!detected.language) return null;

  const config = SAFE_FORMATTERS[detected.language];
  if (!config) return null;

  const extChecks = config.extensions
    .map((ext) => `[ "$ext" = "${ext}" ]`)
    .join(" || ");

  return {
    type: "command",
    command: `fp=${jqField("file_path")}; ext="\${fp##*.}"; (${extChecks}) && ${config.command} "$fp" 2>/dev/null; exit 0`,
  };
}
