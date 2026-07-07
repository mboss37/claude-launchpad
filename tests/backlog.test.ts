import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { generateBacklogMd } from "../src/commands/init/generators/backlog.js";
import { generateClaudeMd } from "../src/commands/init/generators/claude-md.js";
import { generateVerificationRule, VERIFICATION_RULE_VERSION } from "../src/commands/init/generators/verification-rule.js";
import { analyzeRules } from "../src/commands/doctor/analyzers/rules.js";
import { applyFixes } from "../src/commands/doctor/fixer.js";
import { createVerificationRule, updateVerificationRule } from "../src/commands/doctor/fixer-quality.js";
import type { ClaudeConfig, DiagnosticIssue } from "../src/types/index.js";

function makeConfig(overrides: Partial<ClaudeConfig> = {}): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: "# Test",
    claudeMdInstructionCount: 10,
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
    ...overrides,
  };
}

describe("generateBacklogMd", () => {
  it("generates backlog with project name and full wastd template shape", () => {
    const result = generateBacklogMd({ name: "My App", description: "" });
    expect(result).toContain("# My App — Backlog");
    expect(result).toContain("## Priority definitions");
    expect(result).toContain("**P0**");
    expect(result).toContain("**P1**");
    expect(result).toContain("**P2**");
    expect(result).toContain("**P3**");
    expect(result).toContain("## Work package template");
    expect(result).toContain("WP-NNN");
    expect(result).toContain("Trigger to pull");
    expect(result).toContain("Definition of done");
    expect(result).toContain("## P0 — Next sprint");
    expect(result).toContain("## P1 — Soon");
    expect(result).toContain("## P2 — Post-MVP");
    expect(result).toContain("## P3 — Parked");
    expect(result).toContain("## Changelog");
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}: Backlog established\./);
  });

  it("references the workflow rule file", () => {
    const result = generateBacklogMd({ name: "Proj", description: "" });
    expect(result).toContain(".claude/rules/workflow.md");
    expect(result).toContain("move");
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

describe("rules analyzer checks for skill authoring conventions", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `skill-authoring-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(join(testDir, ".claude", "rules"), { recursive: true });
  });

  it("flags missing skill authoring conventions", async () => {
    await writeFile(
      join(testDir, ".claude", "rules", "conventions.md"),
      "# Conventions\n\n- Use conventional commits\n",
    );
    const config = makeConfig({
      claudeMdPath: join(testDir, "CLAUDE.md"),
      rules: [join(testDir, ".claude", "rules", "conventions.md")],
    });
    const result = await analyzeRules(config);
    expect(result.issues.some((i) => i.message.includes("skill authoring"))).toBe(true);
  });

  it("does not flag when skill authoring section exists", async () => {
    await writeFile(
      join(testDir, ".claude", "rules", "conventions.md"),
      "# Conventions\n\n## Skill Authoring\n\n- Follow patterns\n",
    );
    const config = makeConfig({
      claudeMdPath: join(testDir, "CLAUDE.md"),
      rules: [join(testDir, ".claude", "rules", "conventions.md")],
    });
    const result = await analyzeRules(config);
    expect(result.issues.some((i) => i.message.includes("skill authoring"))).toBe(false);
  });

  it("detects skill authoring in any rules file", async () => {
    await writeFile(
      join(testDir, ".claude", "rules", "conventions.md"),
      "# Conventions\n\n- Plain rules\n",
    );
    await writeFile(
      join(testDir, ".claude", "rules", "skills.md"),
      "# Skills\n\n## Skill Authoring\n\n- TRIGGER when clauses\n",
    );
    const config = makeConfig({
      claudeMdPath: join(testDir, "CLAUDE.md"),
      rules: [
        join(testDir, ".claude", "rules", "conventions.md"),
        join(testDir, ".claude", "rules", "skills.md"),
      ],
    });
    const result = await analyzeRules(config);
    expect(result.issues.some((i) => i.message.includes("skill authoring"))).toBe(false);
  });
});

describe("fixer creates BACKLOG.md", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `backlog-fix-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, "CLAUDE.md"), "# Test\n");
  });

  it("creates BACKLOG.md with the wastd WP template for missing backlog issue", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Rules",
      severity: "low",
      message: "No BACKLOG.md found — deferred features get lost in conversation history",
      fix: "Run `claude-launchpad init` or `doctor --fix` to generate one",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const content = await readFile(join(testDir, "BACKLOG.md"), "utf-8");
    expect(content).toContain("— Backlog");
    expect(content).toContain("## Priority definitions");
    expect(content).toContain("WP-NNN");
    expect(content).toContain("## P0 — Next sprint");
    expect(content).toContain("## Changelog");
  });

  it("does not overwrite existing BACKLOG.md (preserves legacy freeform content)", async () => {
    await writeFile(join(testDir, "BACKLOG.md"), "# My Existing Backlog\n\nLegacy freeform content that must not be clobbered.\n");

    const issues: DiagnosticIssue[] = [{
      analyzer: "Rules",
      severity: "low",
      message: "No BACKLOG.md found",
      fix: "Generate one",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.skipped).toBe(1);

    const content = await readFile(join(testDir, "BACKLOG.md"), "utf-8");
    expect(content).toBe("# My Existing Backlog\n\nLegacy freeform content that must not be clobbered.\n");
  });
});

describe("rules analyzer checks for workflow.md", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-rule-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  it("flags missing .claude/rules/workflow.md", async () => {
    const config = makeConfig({ claudeMdPath: join(testDir, "CLAUDE.md") });
    const result = await analyzeRules(config);
    const match = result.issues.find((i) => i.message.includes("workflow.md"));
    expect(match).toBeDefined();
    expect(match?.severity).toBe("medium");
  });

  it("does not flag when workflow.md exists", async () => {
    await mkdir(join(testDir, ".claude", "rules"), { recursive: true });
    await writeFile(join(testDir, ".claude", "rules", "workflow.md"), "---\npaths: []\n---\n");
    const config = makeConfig({ claudeMdPath: join(testDir, "CLAUDE.md") });
    const result = await analyzeRules(config);
    expect(result.issues.some((i) => i.message.includes("workflow.md"))).toBe(false);
  });
});

describe("fixer creates workflow.md", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `workflow-fix-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, "CLAUDE.md"), "# Test\n");
  });

  it("generates workflow.md when missing", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Rules",
      severity: "medium",
      message: "No .claude/rules/workflow.md found — BACKLOG/TASKS workflow is unenforced",
      fix: "Run doctor --fix to generate it",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const content = await readFile(join(testDir, ".claude", "rules", "workflow.md"), "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('paths: ["BACKLOG.md", "TASKS.md"]');
    expect(content).toContain("move");
    expect(content).toContain("WP-NNN");
  });

  it("does not clobber existing workflow.md", async () => {
    await mkdir(join(testDir, ".claude", "rules"), { recursive: true });
    await writeFile(join(testDir, ".claude", "rules", "workflow.md"), "# custom workflow\n");

    const issues: DiagnosticIssue[] = [{
      analyzer: "Rules",
      severity: "medium",
      message: "No .claude/rules/workflow.md found — BACKLOG/TASKS workflow is unenforced",
      fix: "Run doctor --fix to generate it",
    }];

    await applyFixes(issues, testDir);
    const content = await readFile(join(testDir, ".claude", "rules", "workflow.md"), "utf-8");
    expect(content).toBe("# custom workflow\n");
  });
});

describe("collapseMemoryHeadings fixer", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `collapse-mem-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  it("collapses duplicate Memory sections into one canonical heading", async () => {
    const claudeMd = [
      "# Test",
      "",
      "## Memory",
      "- legacy notes from /lp-enhance",
      "",
      "## Stack",
      "- TS",
      "",
      "## Memory (agentic-memory)",
      "- canonical notes from memory install",
      "",
    ].join("\n");
    await writeFile(join(testDir, "CLAUDE.md"), claudeMd);

    const issues: DiagnosticIssue[] = [{
      analyzer: "Quality",
      severity: "medium",
      message: "Duplicate ## Memory headings in CLAUDE.md — memory install appended a second block",
      fix: "Run `doctor --fix` to collapse them",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const updated = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
    const tagged = (updated.match(/^## Memory \(agentic-memory\)\s*$/gm) ?? []).length;
    const plain = (updated.match(/^## Memory\s*$/gm) ?? []).length;
    expect(tagged).toBe(1);
    expect(plain).toBe(0);
    expect(updated).toContain("canonical notes from memory install");
  });

  it("promotes plain ## Memory to canonical heading when only plain exists twice", async () => {
    const claudeMd = [
      "# Test",
      "",
      "## Memory",
      "- first block",
      "",
      "## Stack",
      "- TS",
      "",
      "## Memory",
      "- second block",
      "",
    ].join("\n");
    await writeFile(join(testDir, "CLAUDE.md"), claudeMd);

    const issues: DiagnosticIssue[] = [{
      analyzer: "Quality",
      severity: "medium",
      message: "Duplicate ## Memory headings in CLAUDE.md — memory install appended a second block",
      fix: "Run `doctor --fix` to collapse them",
    }];

    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);

    const updated = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
    expect((updated.match(/^## Memory \(agentic-memory\)\s*$/gm) ?? []).length).toBe(1);
    expect(updated).toContain("first block");
    expect(updated).not.toContain("second block");
  });
});

describe("rules analyzer checks for verification.md", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `verification-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  it("flags a project without .claude/rules/verification.md as medium", async () => {
    const config = makeConfig({ claudeMdPath: join(testDir, "CLAUDE.md") });
    const result = await analyzeRules(config);
    const issue = result.issues.find((i) => i.message.includes("No .claude/rules/verification.md"));
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("medium");
  });

  it("flags an outdated verification.md (version marker below current)", async () => {
    await mkdir(join(testDir, ".claude", "rules"), { recursive: true });
    await writeFile(
      join(testDir, ".claude", "rules", "verification.md"),
      "# Verification Rules\n\n<!-- lp-verification-version: 0 -->\n",
    );
    const config = makeConfig({ claudeMdPath: join(testDir, "CLAUDE.md") });
    const result = await analyzeRules(config);
    expect(result.issues.some((i) => i.message.includes("verification.md rule is outdated"))).toBe(true);
  });

  it("does not flag a current verification.md", async () => {
    await mkdir(join(testDir, ".claude", "rules"), { recursive: true });
    await writeFile(
      join(testDir, ".claude", "rules", "verification.md"),
      generateVerificationRule(),
    );
    const config = makeConfig({ claudeMdPath: join(testDir, "CLAUDE.md") });
    const result = await analyzeRules(config);
    expect(result.issues.some((i) => i.message.toLowerCase().includes("verification"))).toBe(false);
  });
});

describe("verification.md fixers", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `verification-fixer-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });
  });

  it("creates verification.md via --fix and is idempotent", async () => {
    expect(await createVerificationRule(testDir)).toBe(true);
    const content = await readFile(join(testDir, ".claude", "rules", "verification.md"), "utf-8");
    expect(content).toContain("lp-verification-version");
    expect(await createVerificationRule(testDir)).toBe(false);
  });

  it("updates an outdated launchpad-authored verification.md", async () => {
    await mkdir(join(testDir, ".claude", "rules"), { recursive: true });
    await writeFile(
      join(testDir, ".claude", "rules", "verification.md"),
      "# Old\n<!-- lp-verification-version: 0 -->\n",
    );
    expect(await updateVerificationRule(testDir)).toBe(true);
    const content = await readFile(join(testDir, ".claude", "rules", "verification.md"), "utf-8");
    expect(content).toContain(`lp-verification-version: ${VERIFICATION_RULE_VERSION}`);
  });

  it("never clobbers a user-authored verification.md (no version marker)", async () => {
    await mkdir(join(testDir, ".claude", "rules"), { recursive: true });
    await writeFile(join(testDir, ".claude", "rules", "verification.md"), "# My own verification rules\n");
    expect(await updateVerificationRule(testDir)).toBe(false);
    const content = await readFile(join(testDir, ".claude", "rules", "verification.md"), "utf-8");
    expect(content).toBe("# My own verification rules\n");
  });

  it("applyFixes routes the missing-verification finding to the fixer", async () => {
    const issues: DiagnosticIssue[] = [{
      analyzer: "Rules",
      severity: "medium",
      message: "No .claude/rules/verification.md found — nothing stops premature 'done' claims without evidence",
      fix: "Run `doctor --fix` to generate it",
    }];
    const result = await applyFixes(issues, testDir);
    expect(result.fixed).toBe(1);
    await access(join(testDir, ".claude", "rules", "verification.md"));
  });
});
