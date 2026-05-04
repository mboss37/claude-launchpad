import { describe, it, expect } from "vitest";
import { generateWorkflowRule, WORKFLOW_RULE_VERSION } from "../src/commands/init/generators/workflow-rule.js";

describe("generateWorkflowRule", () => {
  it("starts with YAML frontmatter scoped to BACKLOG.md and TASKS.md", () => {
    const content = generateWorkflowRule();
    expect(content).toMatch(/^---\n/);
    expect(content).toContain('paths: ["BACKLOG.md", "TASKS.md"]');
    expect(content.indexOf("---\n", 4)).toBeGreaterThan(0);
  });

  it("includes the move-not-copy single rule", () => {
    const content = generateWorkflowRule();
    expect(content).toContain("exactly one");
    expect(content).toContain("move");
    expect(content).toContain("BACKLOG.md");
    expect(content).toContain("TASKS.md");
  });

  it("defines the WP-NNN ID policy", () => {
    const content = generateWorkflowRule();
    expect(content).toContain("WP-NNN");
    expect(content).toMatch(/three digits|zero-padded/i);
    expect(content).toContain("Never reused");
  });

  it("enumerates BACKLOG structure sections", () => {
    const content = generateWorkflowRule();
    expect(content).toContain("## Priority definitions");
    expect(content).toContain("## Work package template");
    expect(content).toContain("## P0");
    expect(content).toContain("## Changelog");
  });

  it("enumerates TASKS structure sections", () => {
    const content = generateWorkflowRule();
    expect(content).toContain("## Current Sprint");
    expect(content).toContain("## Completed Sprints");
    expect(content).toContain("## Session Log");
  });

  it("lists WP field requirements including XL decomposition", () => {
    const content = generateWorkflowRule();
    expect(content).toContain("Trigger to pull");
    expect(content).toContain("Definition of done");
    expect(content).toContain("XL");
    expect(content).toMatch(/decompose|decomposed/i);
  });

  it("numbers the sprint start and sprint close sequences", () => {
    const content = generateWorkflowRule();
    expect(content).toMatch(/### Starting a sprint/);
    expect(content).toMatch(/### Closing a sprint/);
    expect(content).toMatch(/\n1\. /);
    expect(content).toMatch(/\n6\. /);
  });

  it("lists the staleness trigger conditions", () => {
    const content = generateWorkflowRule();
    expect(content).toMatch(/staleness/i);
    expect(content).toMatch(/80 lines/);
    expect(content).toMatch(/15 items/);
    expect(content).toMatch(/3 entries/);
  });

  it("is genericized — no superpowers-specific skill names", () => {
    const content = generateWorkflowRule();
    expect(content).not.toContain("superpowers:requesting-code-review");
    expect(content).not.toContain("superpowers:writing-plans");
  });

  it("embeds the rule version for future doctor drift detection", () => {
    const content = generateWorkflowRule();
    expect(content).toContain(`lp-workflow-version: ${WORKFLOW_RULE_VERSION}`);
  });
});
