import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { generateBacklogMd } from "../src/commands/init/generators/backlog.js";
import { generateClaudeMd } from "../src/commands/init/generators/claude-md.js";
import { analyzeRules } from "../src/commands/doctor/analyzers/rules.js";
import { applyFixes } from "../src/commands/doctor/fixer.js";
import type { ClaudeConfig, DiagnosticIssue } from "../src/types/index.js";

function makeConfig(overrides: Partial<ClaudeConfig> = {}): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: "# Test",
    claudeMdInstructionCount: 10,
    settingsPath: null,
    settings: null,
    hooks: [],
    rules: [],
    mcpServers: [],
    skills: [],
    claudeignorePath: null,
    claudeignoreContent: null,
    ...overrides,
  };
}

describe("generateBacklogMd", () => {
  it("generates backlog with project name and priority tiers", () => {
    const result = generateBacklogMd({ name: "My App", description: "" });
    expect(result).toContain("# My App — Backlog");
    expect(result).toContain("P0 = next sprint");
    expect(result).toContain("P1 = soon");
    expect(result).toContain("P2 = when relevant");
  });
});

describe("generateClaudeMd includes backlog section", () => {
  it("has a ## Backlog section", () => {
    const result = generateClaudeMd(
      { name: "Test", description: "" },
      { name: "test", language: null, framework: null, packageManager: null, devCommand: null, buildCommand: null, testCommand: null, lintCommand: null, formatCommand: null },
    );
    expect(result).toContain("## Backlog");
    expect(result).toContain("BACKLOG.md");
  });
});

describe("rules analyzer checks for BACKLOG.md", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `backlog-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  it("flags missing BACKLOG.md", async () => {
    const config = makeConfig({ claudeMdPath: join(testDir, "CLAUDE.md") });
    const result = await analyzeRules(config);
    expect(result.issues.some((i) => i.message.includes("BACKLOG.md"))).toBe(true);
  });

  it("does not flag when BACKLOG.md exists", async () => {
    await writeFile(join(testDir, "BACKLOG.md"), "# Backlog\n");
    const config = makeConfig({ claudeMdPath: join(testDir, "CLAUDE.md") });
    const result = await analyzeRules(config);
    expect(result.issues.some((i) => i.message.includes("BACKLOG.md"))).toBe(false);
  });
});

describe("fixer creates BACKLOG.md", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `backlog-fix-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, "CLAUDE.md"), "# Test\n");
  });

  it("creates BACKLOG.md for missing backlog issue", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Rules",
      severity: "low",
      message: "No BACKLOG.md found — deferred features get lost in conversation history",
      fix: "Run `claude-launchpad init` or `doctor --fix` to generate one",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const content = await readFile(join(testDir, "BACKLOG.md"), "utf-8");
    expect(content).toContain("Backlog");
    expect(content).toContain("P0 = next sprint");
  });

  it("does not overwrite existing BACKLOG.md", async () => {
    await writeFile(join(testDir, "BACKLOG.md"), "# My Existing Backlog\n");

    const issues: DiagnosticIssue[] = [{
      analyzer: "Rules",
      severity: "low",
      message: "No BACKLOG.md found",
      fix: "Generate one",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.skipped).toBe(1);

    const content = await readFile(join(testDir, "BACKLOG.md"), "utf-8");
    expect(content).toBe("# My Existing Backlog\n");
  });
});
