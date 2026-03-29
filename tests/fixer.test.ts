import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { applyFixes } from "../src/commands/doctor/fixer.js";
import type { DiagnosticIssue } from "../src/types/index.js";

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `fixer-test-${randomUUID()}`);
  await mkdir(testDir, { recursive: true });
  await writeFile(join(testDir, "CLAUDE.md"), "# Test Project\n");
});

describe("applyFixes", () => {
  it("creates .claude/rules/conventions.md for missing rules", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Rules",
      severity: "low",
      message: "No .claude/rules/ files found",
      fix: "Create rules",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBeGreaterThanOrEqual(1);

    const rulesPath = join(testDir, ".claude", "rules", "conventions.md");
    const content = await readFile(rulesPath, "utf-8");
    expect(content).toContain("conventional commits");
  });

  it("adds .env protection hook for missing hooks", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Hooks",
      severity: "medium",
      message: "No hooks configured — CLAUDE.md rules are advisory",
      fix: "Add hooks",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBeGreaterThanOrEqual(1);

    const settings = JSON.parse(
      await readFile(join(testDir, ".claude", "settings.json"), "utf-8"),
    );
    expect(settings.hooks.PreToolUse).toBeDefined();
    const envHook = settings.hooks.PreToolUse.find(
      (g: Record<string, unknown>) => {
        const hooks = g.hooks as Record<string, unknown>[];
        return hooks?.some((h) => String(h.command ?? "").includes(".env"));
      },
    );
    expect(envHook).toBeDefined();
  });

  it("adds Architecture section to CLAUDE.md", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Quality",
      severity: "medium",
      message: 'Missing "## Architecture/Structure" section',
      fix: "Add section",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const content = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
    expect(content).toContain("## Architecture");
  });

  it("generates .claudeignore when missing", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Rules",
      severity: "low",
      message: "No .claudeignore found",
      fix: "Generate one",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const content = await readFile(join(testDir, ".claudeignore"), "utf-8");
    expect(content).toContain("node_modules");
    expect(content).toContain(".env");
  });

  it("does not duplicate existing sections", async () => {
    await writeFile(
      join(testDir, "CLAUDE.md"),
      "# Test\n## Architecture\n- Existing content\n",
    );

    const issues: DiagnosticIssue[] = [{
      analyzer: "Quality",
      severity: "medium",
      message: 'Missing "## Architecture/Structure" section',
      fix: "Add section",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(0);
  });

  it("adds force-push protection hook", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Permissions",
      severity: "low",
      message: "No force-push protection hook",
      fix: "Add hook",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const settings = JSON.parse(
      await readFile(join(testDir, ".claude", "settings.json"), "utf-8"),
    );
    const bashHook = settings.hooks.PreToolUse.find(
      (g: Record<string, unknown>) => g.matcher === "Bash",
    );
    expect(bashHook).toBeDefined();
  });

  it("handles multiple fixes in one pass", async () => {
    const issues: DiagnosticIssue[] = [
      { analyzer: "Quality", severity: "medium", message: 'Missing "## Off-Limits" section', fix: "" },
      { analyzer: "Rules", severity: "low", message: "No .claude/rules/ files found", fix: "" },
      { analyzer: "Permissions", severity: "low", message: "No force-push protection hook", fix: "" },
    ];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(3);
  });

  it("adds credential deny rules to settings.json", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Permissions",
      severity: "high",
      message: "Credential files not blocked: Read(~/.ssh/*), Read(~/.aws/*), Read(~/.npmrc)",
      fix: "",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const settings = JSON.parse(
      await readFile(join(testDir, ".claude", "settings.json"), "utf-8"),
    );
    expect(settings.permissions.deny).toContain("Read(~/.ssh/*)");
    expect(settings.permissions.deny).toContain("Read(~/.aws/*)");
    expect(settings.permissions.deny).toContain("Read(~/.npmrc)");
  });

  it("adds disableBypassPermissionsMode to settings.json", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Permissions",
      severity: "high",
      message: "Bypass permissions mode not disabled",
      fix: "",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const settings = JSON.parse(
      await readFile(join(testDir, ".claude", "settings.json"), "utf-8"),
    );
    expect(settings.disableBypassPermissionsMode).toBe("disable");
  });

  it("adds sandbox settings to settings.json", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Permissions",
      severity: "medium",
      message: "Sandbox not enabled",
      fix: "",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const settings = JSON.parse(
      await readFile(join(testDir, ".claude", "settings.json"), "utf-8"),
    );
    expect(settings.sandbox.enabled).toBe(true);
    expect(settings.sandbox.failIfUnavailable).toBe(true);
  });

  it("adds .env to .claudeignore", async () => {
    await writeFile(join(testDir, ".claudeignore"), "node_modules\ndist\n");

    const issues: DiagnosticIssue[] = [{
      analyzer: "Permissions",
      severity: "medium",
      message: ".env is protected by hooks but not in .claudeignore",
      fix: "",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const content = await readFile(join(testDir, ".claudeignore"), "utf-8");
    expect(content).toContain(".env");
    expect(content).toContain(".env.*");
  });

  it("does not duplicate credential deny rules", async () => {
    await mkdir(join(testDir, ".claude"), { recursive: true });
    await writeFile(
      join(testDir, ".claude", "settings.json"),
      JSON.stringify({ permissions: { deny: ["Read(~/.ssh/*)", "Read(~/.aws/*)", "Read(~/.npmrc)"] } }),
    );

    const issues: DiagnosticIssue[] = [{
      analyzer: "Permissions",
      severity: "high",
      message: "Credential files not blocked: Read(~/.ssh/*)",
      fix: "",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(0);
  });

  it("migrates includeCoAuthoredBy to attribution object", async () => {
    await mkdir(join(testDir, ".claude"), { recursive: true });
    await writeFile(
      join(testDir, ".claude", "settings.json"),
      JSON.stringify({ includeCoAuthoredBy: false, hooks: {} }),
    );

    const issues: DiagnosticIssue[] = [{
      analyzer: "Settings",
      severity: "low",
      message: "Deprecated includeCoAuthoredBy — use attribution object",
      fix: "",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const settings = JSON.parse(
      await readFile(join(testDir, ".claude", "settings.json"), "utf-8"),
    );
    expect(settings.attribution).toEqual({ commit: "", pr: "" });
    expect(settings.includeCoAuthoredBy).toBeUndefined();
  });
});
