import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { rewriteEnvVarHooks } from "../src/commands/doctor/fixer-hook-input.js";
import { hasEnvVarHookPattern } from "../src/lib/hook-input.js";

interface Settings {
  hooks?: Record<string, Array<{
    matcher?: string;
    hooks: Array<{ type: string; command: string }>;
  }>>;
}

async function mkProject(settings: Settings): Promise<string> {
  const root = join(tmpdir(), `lp-hook-fixer-${randomUUID()}`);
  await mkdir(join(root, ".claude"), { recursive: true });
  await writeFile(
    join(root, ".claude", "settings.json"),
    JSON.stringify(settings, null, 2),
  );
  return root;
}

async function readSettings(root: string): Promise<Settings> {
  const raw = await readFile(join(root, ".claude", "settings.json"), "utf-8");
  return JSON.parse(raw) as Settings;
}

describe("rewriteEnvVarHooks", () => {
  let root: string;

  beforeEach(async () => {
    root = "";
  });

  it("rewrites the .env-block hook to jq+stdin form", async () => {
    root = await mkProject({
      hooks: {
        PreToolUse: [{
          matcher: "Read|Write|Edit",
          hooks: [{
            type: "command",
            command: `echo "$TOOL_INPUT_FILE_PATH" | grep -qE '\\.(env|env\\..*)$' && ! echo "$TOOL_INPUT_FILE_PATH" | grep -q '.env.example' && echo 'BLOCKED: .env files contain secrets' && exit 1; exit 0`,
          }],
        }],
      },
    });
    const fixed = await rewriteEnvVarHooks(root);
    expect(fixed).toBe(true);
    const after = await readSettings(root);
    const cmd = after.hooks!.PreToolUse![0].hooks[0].command;
    expect(hasEnvVarHookPattern(cmd)).toBe(false);
    expect(cmd).toContain(`jq -r '.tool_input.file_path`);
    expect(cmd).toContain("BLOCKED: .env files contain secrets");
  });

  it("rewrites the destructive-bash block hook", async () => {
    root = await mkProject({
      hooks: {
        PreToolUse: [{
          matcher: "Bash",
          hooks: [{
            type: "command",
            command: `echo "$TOOL_INPUT_COMMAND" | grep -qE 'rm\\s+-rf\\s+/' && echo 'BLOCKED: Destructive command detected' && exit 1; exit 0`,
          }],
        }],
      },
    });
    await rewriteEnvVarHooks(root);
    const after = await readSettings(root);
    const cmd = after.hooks!.PreToolUse![0].hooks[0].command;
    expect(hasEnvVarHookPattern(cmd)).toBe(false);
    expect(cmd).toContain(`jq -r '.tool_input.command`);
    expect(cmd).toContain("BLOCKED: Destructive command detected");
  });

  it("rewrites the force-push hook", async () => {
    root = await mkProject({
      hooks: {
        PreToolUse: [{
          matcher: "Bash",
          hooks: [{
            type: "command",
            command: `echo "$TOOL_INPUT_COMMAND" | grep -qE 'push.*--force|push.*-f' && echo 'WARNING: Force push detected — this can destroy remote history' && exit 1; exit 0`,
          }],
        }],
      },
    });
    await rewriteEnvVarHooks(root);
    const after = await readSettings(root);
    const cmd = after.hooks!.PreToolUse![0].hooks[0].command;
    expect(hasEnvVarHookPattern(cmd)).toBe(false);
    expect(cmd).toContain(`jq -r '.tool_input.command`);
    expect(cmd).toContain("Force push detected");
  });

  it("rewrites the auto-format hook preserving formatter + extensions", async () => {
    root = await mkProject({
      hooks: {
        PostToolUse: [{
          matcher: "Write|Edit",
          hooks: [{
            type: "command",
            command: `ext=\${TOOL_INPUT_FILE_PATH##*.}; ([ "$ext" = "ts" ] || [ "$ext" = "tsx" ]) && npx prettier --write "$TOOL_INPUT_FILE_PATH" 2>/dev/null; exit 0`,
          }],
        }],
      },
    });
    await rewriteEnvVarHooks(root);
    const after = await readSettings(root);
    const cmd = after.hooks!.PostToolUse![0].hooks[0].command;
    expect(hasEnvVarHookPattern(cmd)).toBe(false);
    expect(cmd).toContain(`jq -r '.tool_input.file_path`);
    expect(cmd).toContain("npx prettier --write");
    expect(cmd).toMatch(/\$ext.*=.*"ts"/);
  });

  it("rewrites the sprint-complete nudge", async () => {
    root = await mkProject({
      hooks: {
        PostToolUse: [{
          matcher: "Edit|Write",
          hooks: [{
            type: "command",
            command: `echo "$TOOL_INPUT_FILE_PATH" | grep -q TASKS.md || exit 0; section=$(sed -n '/^## Current/,/^## /p' TASKS.md 2>/dev/null); [ -z "$section" ] && exit 0; unchecked=$(echo "$section" | grep -cF '- [ ]' || true); checked=$(echo "$section" | grep -cF '- [x]' || true); [ "$unchecked" -eq 0 ] && [ "$checked" -gt 0 ] && echo 'Sprint complete — all current tasks done. Consider a quick quality check before committing: scan for dead code, debug artifacts, TODO hacks, and convention violations. Run tests if available. Skip if trivial.'; exit 0`,
          }],
        }],
      },
    });
    await rewriteEnvVarHooks(root);
    const after = await readSettings(root);
    const cmd = after.hooks!.PostToolUse![0].hooks[0].command;
    expect(hasEnvVarHookPattern(cmd)).toBe(false);
    expect(cmd).toContain(`jq -r '.tool_input.file_path`);
    expect(cmd).toContain("Sprint complete");
  });

  it("is idempotent — second run is a no-op", async () => {
    root = await mkProject({
      hooks: {
        PreToolUse: [{
          matcher: "Read|Write|Edit",
          hooks: [{
            type: "command",
            command: `echo "$TOOL_INPUT_FILE_PATH" | grep -q .env && echo 'BLOCKED: .env files contain secrets' && exit 1; exit 0`,
          }],
        }],
      },
    });
    const first = await rewriteEnvVarHooks(root);
    expect(first).toBe(true);
    const second = await rewriteEnvVarHooks(root);
    expect(second).toBe(false);
  });

  it("does NOT clobber unrecognized user-customized hooks (leaves bug for manual fix)", async () => {
    const userCustomCmd = `fp="$TOOL_INPUT_FILE_PATH"; echo "$fp" | grep -qE '^docs/.+\\.md$' || exit 0; echo 'user-specific check'; exit 0`;
    root = await mkProject({
      hooks: {
        PostToolUse: [{
          matcher: "Edit|Write",
          hooks: [{
            type: "command",
            command: userCustomCmd,
          }],
        }],
      },
    });
    const fixed = await rewriteEnvVarHooks(root);
    expect(fixed).toBe(false);
    const after = await readSettings(root);
    expect(after.hooks!.PostToolUse![0].hooks[0].command).toBe(userCustomCmd);
  });

  it("leaves clean (jq-stdin) hooks alone", async () => {
    const clean = `fp=$(jq -r '.tool_input.file_path // empty' 2>/dev/null); echo "$fp" | grep -q TASKS.md; exit 0`;
    root = await mkProject({
      hooks: {
        PostToolUse: [{
          matcher: "Edit|Write",
          hooks: [{ type: "command", command: clean }],
        }],
      },
    });
    const fixed = await rewriteEnvVarHooks(root);
    expect(fixed).toBe(false);
    const after = await readSettings(root);
    expect(after.hooks!.PostToolUse![0].hooks[0].command).toBe(clean);
  });

  it("rewrites workflow-check.sh on disk when it has the env-var bug", async () => {
    root = join(tmpdir(), `lp-hook-fixer-${randomUUID()}`);
    await mkdir(join(root, ".claude", "hooks"), { recursive: true });
    await writeFile(join(root, ".claude", "settings.json"), "{}");
    const oldScript = `#!/usr/bin/env bash\nset -u\nfp="\${TOOL_INPUT_FILE_PATH:-}"\necho "$fp"\n`;
    await writeFile(join(root, ".claude", "hooks", "workflow-check.sh"), oldScript);
    const fixed = await rewriteEnvVarHooks(root);
    expect(fixed).toBe(true);
    const after = await readFile(join(root, ".claude", "hooks", "workflow-check.sh"), "utf-8");
    expect(hasEnvVarHookPattern(after)).toBe(false);
    expect(after).toContain(`jq -r '.tool_input.file_path`);
  });

  it("rewrites sprint-open-check.sh on disk when it has the env-var bug", async () => {
    root = join(tmpdir(), `lp-hook-fixer-${randomUUID()}`);
    await mkdir(join(root, ".claude", "hooks"), { recursive: true });
    await writeFile(join(root, ".claude", "settings.json"), "{}");
    const oldScript = `#!/usr/bin/env bash\nset -u\ncmd="\${TOOL_INPUT_COMMAND:-}"\necho "$cmd"\n`;
    await writeFile(join(root, ".claude", "hooks", "sprint-open-check.sh"), oldScript);
    const fixed = await rewriteEnvVarHooks(root);
    expect(fixed).toBe(true);
    const after = await readFile(join(root, ".claude", "hooks", "sprint-open-check.sh"), "utf-8");
    expect(hasEnvVarHookPattern(after)).toBe(false);
    expect(after).toContain(`jq -r '.tool_input.command`);
  });
});
