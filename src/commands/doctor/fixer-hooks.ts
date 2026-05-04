import { addHookToSettings } from "../../lib/hook-builder.js";
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

export async function addPostCompactHook(root: string): Promise<boolean> {
  return addHookToSettings(root, "PostCompact", "TASKS.md", {
    matcher: "",
    hooks: [{ type: "command", command: "cat TASKS.md 2>/dev/null; exit 0" }],
  }, "Added PostCompact hook (re-injects TASKS.md after compaction)");
}

export async function addSessionStartHook(root: string): Promise<boolean> {
  return addHookToSettings(root, "SessionStart", "TASKS.md", {
    matcher: "startup|resume",
    hooks: [{ type: "command", command: "cat TASKS.md 2>/dev/null; exit 0" }],
  }, "Added SessionStart hook (injects TASKS.md at startup)");
}
