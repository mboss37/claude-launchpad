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

  // PostCompact: re-inject TASKS.md so session continuity survives compaction
  const postCompact: HookGroup[] = [{
    matcher: "",
    hooks: [{
      type: "command",
      command: "cat TASKS.md 2>/dev/null; exit 0",
    }],
  }];

  const hooks: Record<string, ReadonlyArray<HookGroup>> = {};
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
      ],
    },
    hooks,
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
