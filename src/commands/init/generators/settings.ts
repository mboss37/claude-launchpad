import type { DetectedProject } from "../../../types/index.js";

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
  readonly sandbox?: {
    readonly enabled: boolean;
    readonly failIfUnavailable: boolean;
  };
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
      command: "echo \"$TOOL_INPUT_FILE_PATH\" | grep -qE '\\.(env|env\\..*)$' && ! echo \"$TOOL_INPUT_FILE_PATH\" | grep -q '.env.example' && echo 'BLOCKED: .env files contain secrets' && exit 1; exit 0",
    }],
  });

  // Universal: block destructive commands
  preToolUse.push({
    matcher: "Bash",
    hooks: [{
      type: "command",
      command: "echo \"$TOOL_INPUT_COMMAND\" | grep -qE 'rm\\s+-rf\\s+/|DROP\\s+TABLE|DROP\\s+DATABASE|push.*--force|push.*-f' && echo 'BLOCKED: Destructive command detected' && exit 1; exit 0",
    }],
  });

  // Auto-format based on detected tooling
  const formatHook = buildFormatHook(detected);
  if (formatHook) {
    postToolUse.push(formatHook);
  }

  // Sprint review: nudge when all current sprint tasks are complete
  postToolUse.push({
    matcher: "Edit|Write",
    hooks: [{
      type: "command",
      command: "echo \"$TOOL_INPUT_FILE_PATH\" | grep -q TASKS.md || exit 0; section=$(sed -n '/^## Current Sprint/,/^## /p' TASKS.md 2>/dev/null); [ -z \"$section\" ] && exit 0; unchecked=$(echo \"$section\" | grep -cF '- [ ]' || true); checked=$(echo \"$section\" | grep -cF '- [x]' || true); [ \"$unchecked\" -eq 0 ] && [ \"$checked\" -gt 0 ] && echo 'Sprint complete — all current tasks done. Consider a quick quality check before committing: scan for dead code, debug artifacts, TODO hacks, and convention violations. Run tests if available. Skip if trivial.'; exit 0",
    }],
  });

  // SessionStart: inject TASKS.md at session startup
  const sessionStart: HookGroup[] = [{
    matcher: "startup|resume",
    hooks: [{
      type: "command",
      command: "cat TASKS.md 2>/dev/null; exit 0",
    }],
  }];

  // PostCompact: re-inject TASKS.md so session continuity survives compaction
  const postCompact: HookGroup[] = [{
    matcher: "",
    hooks: [{
      type: "command",
      command: "cat TASKS.md 2>/dev/null; exit 0",
    }],
  }];

  const hooks: Record<string, ReadonlyArray<HookGroup>> = {};
  hooks.SessionStart = sessionStart;
  if (preToolUse.length > 0) hooks.PreToolUse = preToolUse;
  if (postToolUse.length > 0) hooks.PostToolUse = postToolUse;
  hooks.PostCompact = postCompact;

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
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
    },
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

function buildFormatHook(detected: DetectedProject): HookGroup | null {
  if (!detected.language) return null;

  const config = SAFE_FORMATTERS[detected.language];
  if (!config) return null;

  const extChecks = config.extensions
    .map((ext) => `[ "$ext" = "${ext}" ]`)
    .join(" || ");

  return {
    matcher: "Write|Edit",
    hooks: [{
      type: "command",
      command: `ext=\${TOOL_INPUT_FILE_PATH##*.}; (${extChecks}) && ${config.command} "$TOOL_INPUT_FILE_PATH" 2>/dev/null; exit 0`,
    }],
  };
}
