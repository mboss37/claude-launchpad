import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { FORCE_PUSH_ERE } from "../src/lib/hook-input.js";
import { generateSettings } from "../src/commands/init/generators/settings.js";
import { STOP_AND_SWARM_CONTENT } from "../src/lib/sections.js";
import { generateClaudeMd } from "../src/commands/init/generators/claude-md.js";
import { isKeyDecisionsPlaceholder } from "../src/commands/doctor/analyzers/quality.js";
import { rewriteEnvVarHooks } from "../src/commands/doctor/fixer-hook-input.js";

const DETECTED = {
  name: "t",
  language: "TypeScript",
  framework: null,
  packageManager: "npm",
  devCommand: null,
  buildCommand: null,
  testCommand: null,
  lintCommand: null,
  formatCommand: null,
};

function grepMatches(pattern: string, line: string): boolean {
  try {
    execFileSync("bash", [
      "-c",
      `printf '%s' "$1" | grep -qE "$2"`,
      "_",
      line,
      pattern,
    ]);
    return true;
  } catch {
    return false;
  }
}

describe("WP-042: force-push pattern matches real force pushes only", () => {
  const blocked = [
    "git push --force",
    "git push -f origin main",
    "git push origin main --force",
    "git push origin main --force-with-lease",
    "cd repo && git push -f",
    "git push --force-with-lease=origin/main",
    "git -C /tmp/repo push -f",
    "git -c core.editor=true push --force",
    "git push -fu origin main",
    "git push -f&&echo done",
    "git push --force;true",
    "git push origin +main",
  ];
  const allowed = [
    "git stash push -m wip -- package.json && pnpm install --frozen-lockfile",
    "pnpm install --force",
    "git push origin main",
    "grep -n force hook-input-fixer.test.ts",
    "git push origin main && rm notes -f",
    "git push origin main; pnpm install --frozen-lockfile",
    "echo 'how to git push safely' > notes-f.md",
  ];
  for (const cmd of blocked) {
    it(`blocks: ${cmd}`, () =>
      expect(grepMatches(FORCE_PUSH_ERE, cmd)).toBe(true));
  }
  for (const cmd of allowed) {
    it(`allows: ${cmd}`, () =>
      expect(grepMatches(FORCE_PUSH_ERE, cmd)).toBe(false));
  }

  it("generated destructive hook uses the anchored pattern, not push.*-f", () => {
    const settings = JSON.stringify(generateSettings(DETECTED));
    expect(settings).not.toContain("push.*--force");
    expect(settings).not.toContain("push.*-f");
    expect(settings).toContain("git +(");
  });
});

describe("WP-013: rewriteEnvVarHooks patches settings.local.json too", () => {
  it("fixes the env-var bug when it lives only in settings.local.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "wp013-"));
    await mkdir(join(root, ".claude"), { recursive: true });
    await writeFile(
      join(root, ".claude", "settings.local.json"),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Read|Write|Edit",
              hooks: [
                {
                  type: "command",
                  command: `echo "$TOOL_INPUT_FILE_PATH" | grep -qE '\\.(env|env\\..*)$' && ! echo "$TOOL_INPUT_FILE_PATH" | grep -q '.env.example' && { echo 'BLOCKED: .env files contain secrets' >&2; exit 2; }; exit 0`,
                },
              ],
            },
          ],
        },
      }),
    );
    const fixed = await rewriteEnvVarHooks(root);
    expect(fixed).toBe(true);
    const updated = await readFile(
      join(root, ".claude", "settings.local.json"),
      "utf-8",
    );
    expect(updated).not.toContain("TOOL_INPUT_FILE_PATH");
    expect(updated).toContain("jq -r");
  });
});

describe("WP-039: Stop-and-Swarm ships the agent brief structure", () => {
  it("includes the 4-part brief and the testimony rule", () => {
    expect(STOP_AND_SWARM_CONTENT).toContain("Mission");
    expect(STOP_AND_SWARM_CONTENT).toContain("Scope fence");
    expect(STOP_AND_SWARM_CONTENT).toContain("Return format");
    expect(STOP_AND_SWARM_CONTENT).toMatch(/testimony/i);
    expect(STOP_AND_SWARM_CONTENT).toMatch(/spot-check/i);
  });
});

describe("WP-040: Key Decisions ships the why-log format", () => {
  it("generated CLAUDE.md carries the append-at-decision-time format", () => {
    const md = generateClaudeMd({ name: "T", description: "" }, DETECTED);
    expect(md).toContain("## Key Decisions");
    expect(md).toMatch(/Chose X over Y because Z/);
    expect(md).toMatch(/Revisit if/);
    expect(md).toMatch(/moment/i);
  });

  it("isKeyDecisionsPlaceholder: true for comment-only section, false for real entries", () => {
    const placeholder =
      "## Key Decisions\n<!-- one entry per choice -->\n<!-- 2026-01-01 — Chose X over Y because Z. Revisit if W. -->\n";
    const real =
      "## Key Decisions\n- 2026-07-01 — Chose SQLite over Postgres because zero-infra. Revisit if multi-writer.\n";
    expect(isKeyDecisionsPlaceholder(placeholder)).toBe(true);
    expect(isKeyDecisionsPlaceholder(real)).toBe(false);
    expect(isKeyDecisionsPlaceholder("# no section at all")).toBe(false);
  });

  it("doctor flags placeholder-only Key Decisions in a 20+ commit repo", async () => {
    const root = await mkdtemp(join(tmpdir(), "wp040-"));
    execSync(
      "git init -q && git -c user.name=t -c user.email=t@t commit -q --allow-empty -m init",
      { cwd: root },
    );
    for (let i = 0; i < 20; i++) {
      execSync(
        `git -c user.name=t -c user.email=t@t commit -q --allow-empty -m c${i}`,
        { cwd: root },
      );
    }
    const { analyzeQuality } =
      await import("../src/commands/doctor/analyzers/quality.js");
    const md =
      "# T\n## Stack\n- x\n## Key Decisions\n<!-- Append one entry per non-obvious choice -->\n";
    await writeFile(join(root, "CLAUDE.md"), md);
    const result = await analyzeQuality(
      {
        claudeMdPath: join(root, "CLAUDE.md"),
        claudeMdContent: md,
        claudeMdInstructionCount: 5,
        settingsPath: null,
        settings: null,
        localClaudeMdContent: null,
        localSettings: null,
        hooks: [],
        rules: [],
        mcpServers: [],
        skills: [],
        claudeignorePath: null,
        claudeignoreContent: null,
      },
      root,
    );
    expect(
      result.issues.some(
        (i) => i.message.includes("Key Decisions") && i.severity === "low",
      ),
    ).toBe(true);
  });
});

describe("WP-042 field migration: stale pattern flagged and upgraded", () => {
  const STALE = "cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null); echo \"$cmd\" | grep -qE 'push.*--force|push.*-f' && { echo 'WARNING' >&2; exit 2; }; exit 0";

  it("hooks analyzer flags the outdated pattern", async () => {
    const { analyzeHooks } = await import("../src/commands/doctor/analyzers/hooks.js");
    const result = await analyzeHooks({
      claudeMdPath: "/t/CLAUDE.md", claudeMdContent: "# T", claudeMdInstructionCount: 1,
      settingsPath: "/t/.claude/settings.json", settings: {}, localClaudeMdContent: null, localSettings: null,
      hooks: [{ event: "PreToolUse", type: "command", matcher: "Bash", command: STALE }],
      rules: [], mcpServers: [], skills: [], claudeignorePath: null, claudeignoreContent: null,
    }, "/t");
    expect(result.issues.some((i) => i.message.includes("outdated pattern"))).toBe(true);
  });

  it("upgradeForcePushPattern rewrites both settings files, idempotently", async () => {
    const { upgradeForcePushPattern } = await import("../src/commands/doctor/fixer-hooks.js");
    const { FORCE_PUSH_ERE } = await import("../src/lib/hook-input.js");
    const root = await mkdtemp(join(tmpdir(), "wp042mig-"));
    await mkdir(join(root, ".claude"), { recursive: true });
    await writeFile(join(root, ".claude", "settings.json"), JSON.stringify({
      hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: STALE }] }] },
    }));
    expect(await upgradeForcePushPattern(root)).toBe(true);
    const updated = await readFile(join(root, ".claude", "settings.json"), "utf-8");
    expect(updated).not.toContain("push.*--force|push.*-f");
    expect(JSON.parse(updated).hooks.PreToolUse[0].hooks[0].command).toContain(FORCE_PUSH_ERE);
    expect(await upgradeForcePushPattern(root)).toBe(false);
  });
});
