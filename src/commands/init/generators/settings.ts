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
  readonly hooks?: Record<string, ReadonlyArray<HookGroup>>;
}

/**
 * Generate .claude/settings.json based on detected project.
 * No third-party plugin dependencies — just hooks that match the project's tooling.
 *
 * Claude Code hook schema:
 * { "PostToolUse": [{ "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "..." }] }] }
 */
export function generateSettings(detected: DetectedProject): ClaudeSettings {
  const preToolUse: HookGroup[] = [];
  const postToolUse: HookGroup[] = [];

  // Universal: .env file protection (block read + write)
  preToolUse.push({
    matcher: "Read|Write|Edit",
    hooks: [{
      type: "command",
      command: "echo \"$TOOL_INPUT_FILE_PATH\" | grep -qE '\\.(env|env\\..*)$' && ! echo \"$TOOL_INPUT_FILE_PATH\" | grep -q '.env.example' && echo 'BLOCKED: .env files contain secrets — use .env.example for documentation' && exit 1; exit 0",
    }],
  });

  // Auto-format based on detected tooling
  const formatHook = buildFormatHook(detected);
  if (formatHook) {
    postToolUse.push(formatHook);
  }

  const hooks: Record<string, ReadonlyArray<HookGroup>> = {};
  if (preToolUse.length > 0) hooks.PreToolUse = preToolUse;
  if (postToolUse.length > 0) hooks.PostToolUse = postToolUse;

  return Object.keys(hooks).length > 0 ? { hooks } : {};
}

function buildFormatHook(detected: DetectedProject): HookGroup | null {
  if (!detected.language) return null;

  const formatters: Record<string, { extensions: string[]; command: string }> = {
    TypeScript: {
      extensions: ["ts", "tsx"],
      command: detected.formatCommand ?? "npx prettier --write",
    },
    JavaScript: {
      extensions: ["js", "jsx"],
      command: detected.formatCommand ?? "npx prettier --write",
    },
    Python: {
      extensions: ["py"],
      command: detected.formatCommand ?? "ruff format",
    },
    Go: {
      extensions: ["go"],
      command: "gofmt -w",
    },
    Rust: {
      extensions: ["rs"],
      command: "rustfmt",
    },
    Ruby: {
      extensions: ["rb"],
      command: "rubocop -A",
    },
    Dart: {
      extensions: ["dart"],
      command: "dart format",
    },
    PHP: {
      extensions: ["php"],
      command: detected.formatCommand ?? "vendor/bin/pint",
    },
    Kotlin: {
      extensions: ["kt", "kts"],
      command: "ktlint -F",
    },
    Java: {
      extensions: ["java"],
      command: "google-java-format -i",
    },
    Swift: {
      extensions: ["swift"],
      command: "swift-format format -i",
    },
    Elixir: {
      extensions: ["ex", "exs"],
      command: "mix format",
    },
    "C#": {
      extensions: ["cs"],
      command: "dotnet format",
    },
  };

  const config = formatters[detected.language];
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
