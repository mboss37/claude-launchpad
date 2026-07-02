import { describe, it, expect } from "vitest";
import { generateReviewerAgent, REVIEWER_AGENT_VERSION } from "../src/commands/init/generators/agent-reviewer.js";

describe("generateReviewerAgent", () => {
  const content = generateReviewerAgent();

  it("has frontmatter with name, description, and read-only tools + Bash for git", () => {
    expect(content).toMatch(/^---\nname: code-reviewer\n/);
    expect(content).toContain("tools: Read, Glob, Grep, Bash");
  });

  it("carries a version marker for doctor staleness detection", () => {
    expect(content).toContain(`<!-- lp-reviewer-version: ${REVIEWER_AGENT_VERSION} -->`);
  });

  it("instructs the base-SHA discovery and severity-gated output", () => {
    expect(content).toContain("chore(sprint-");
    for (const section of ["Strengths", "Critical", "Important", "Minor", "Assessment"]) {
      expect(content).toContain(section);
    }
    expect(content).toContain("file:line");
  });

  it("frames the reviewer as independent/fresh-context", () => {
    expect(content).toMatch(/did NOT write this code/);
  });
});
