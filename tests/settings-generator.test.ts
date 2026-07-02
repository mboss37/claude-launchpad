import { describe, it, expect } from "vitest";
import { generateSettings } from "../src/commands/init/generators/settings.js";
import type { DetectedProject } from "../src/types/index.js";

const baseProject: DetectedProject = {
  name: "test",
  language: "TypeScript",
  framework: null,
  packageManager: "npm",
  hasTests: true,
  hasLinter: false,
  hasFormatter: false,
  formatCommand: null,
  lintCommand: null,
  testCommand: "npm run test",
  devCommand: null,
  buildCommand: null,
};

describe("generateSettings", () => {
  it("includes credential deny rules", () => {
    const settings = generateSettings(baseProject);
    const deny = settings.permissions?.deny ?? [];
    expect(deny).toContain("Read(~/.ssh/*)");
    expect(deny).toContain("Read(~/.aws/*)");
    expect(deny).toContain("Read(~/.npmrc)");
  });

  it("includes original deny rules", () => {
    const settings = generateSettings(baseProject);
    const deny = settings.permissions?.deny ?? [];
    expect(deny).toContain("Bash(rm -rf /)");
    expect(deny).toContain("Read(.env)");
    expect(deny).toContain("Read(secrets/**)");
  });

  it("disables bypass permissions mode", () => {
    const settings = generateSettings(baseProject);
    expect(settings.disableBypassPermissionsMode).toBe("disable");
  });

  it("does not generate a sandbox block", () => {
    const settings = generateSettings(baseProject);
    expect((settings as Record<string, unknown>).sandbox).toBeUndefined();
  });

  it("generates 8 deny rules total", () => {
    const settings = generateSettings(baseProject);
    expect(settings.permissions?.deny).toHaveLength(8);
  });

  it("includes ONE consolidated SessionStart entry (TASKS.md inject + sprint-size-check) covering compact/clear", () => {
    const settings = generateSettings(baseProject);
    const hooks = settings.hooks as Record<string, ReadonlyArray<{ matcher?: string; hooks: ReadonlyArray<{ command: string }> }>>;
    expect(hooks.SessionStart).toBeDefined();
    // Same-matcher entries are undefined behavior — everything shares one entry
    expect(hooks.SessionStart).toHaveLength(1);
    const entry = hooks.SessionStart[0];
    // compact/clear matchers replace the nonexistent PostCompact event
    expect(entry.matcher).toBe("startup|resume|compact|clear");
    expect(entry.hooks.some((h) => h.command.includes("cat TASKS.md"))).toBe(true);
    expect(entry.hooks.some((h) => h.command.includes("sprint-size-check.sh"))).toBe(true);
  });

  it("does not emit a PostCompact event (it does not exist in Claude Code)", () => {
    const settings = generateSettings(baseProject);
    expect((settings.hooks as Record<string, unknown>).PostCompact).toBeUndefined();
  });

  it("never emits two entries with the same matcher under one event", () => {
    const settings = generateSettings(baseProject);
    const hooks = settings.hooks as Record<string, ReadonlyArray<{ matcher?: string }>>;
    for (const [event, groups] of Object.entries(hooks)) {
      const matchers = groups.map((g) => g.matcher ?? "");
      expect(new Set(matchers).size, `duplicate matcher under ${event}`).toBe(matchers.length);
    }
  });

  it("sprint-complete nudge emits additionalContext JSON naming /code-review", () => {
    const settings = generateSettings(baseProject);
    const hooks = settings.hooks as Record<string, ReadonlyArray<{ hooks: ReadonlyArray<{ command: string }> }>>;
    const commands = (hooks.PostToolUse ?? []).flatMap((g) => g.hooks.map((h) => h.command));
    const nudge = commands.find((c) => c.includes("Sprint complete"));
    expect(nudge).toBeDefined();
    expect(nudge).toContain("additionalContext");
    expect(nudge).toContain("/code-review");
  });

  it("registers workflow-check.sh as a PostToolUse hook", () => {
    const settings = generateSettings(baseProject);
    const hooks = settings.hooks as Record<string, ReadonlyArray<{ readonly matcher?: string; readonly hooks: ReadonlyArray<{ readonly command?: string }> }>>;
    const postToolUse = hooks.PostToolUse ?? [];
    const commands = postToolUse.flatMap((group) => group.hooks.map((h) => h.command ?? ""));
    expect(commands.some((c) => c.includes("workflow-check.sh"))).toBe(true);
  });
});
