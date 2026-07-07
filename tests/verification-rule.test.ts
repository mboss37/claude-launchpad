import { describe, it, expect } from "vitest";
import {
  generateVerificationRule,
  VERIFICATION_RULE_VERSION,
} from "../src/commands/init/generators/verification-rule.js";

describe("generateVerificationRule", () => {
  it("is always-on: starts with a heading, not path-scoped frontmatter", () => {
    const content = generateVerificationRule();
    expect(content.startsWith("# ")).toBe(true);
    expect(content).not.toContain("paths:");
  });

  it("carries the version marker matching the exported constant", () => {
    const content = generateVerificationRule();
    expect(content).toContain(
      `<!-- lp-verification-version: ${VERIFICATION_RULE_VERSION} -->`,
    );
  });

  it("demands evidence before any done/fixed/passing claim", () => {
    const content = generateVerificationRule();
    expect(content).toContain("## Evidence before assertion");
    expect(content).toMatch(/run .* this session/i);
    expect(content).toMatch(/quot(e|ing) the output/i);
  });

  it("distinguishes behavior from build", () => {
    const content = generateVerificationRule();
    expect(content).toMatch(
      /compil\w+ is not working|typecheck\w* is not working/i,
    );
  });

  it("defines the three belief labels", () => {
    const content = generateVerificationRule();
    expect(content).toContain("**verified**");
    expect(content).toContain("**inferred**");
    expect(content).toContain("**assumed**");
  });

  it("names the done-with-gaps rule for unverifiable steps", () => {
    const content = generateVerificationRule();
    expect(content).toContain("done-with-gaps");
    expect(content).toMatch(/never round/i);
  });

  it("includes the end-of-turn check", () => {
    const content = generateVerificationRule();
    expect(content).toContain("## End-of-turn check");
  });

  it("requires reproduce-before-fix for bugs", () => {
    const content = generateVerificationRule();
    expect(content).toMatch(/reproduce/i);
    expect(content).toMatch(/root.cause/i);
  });
});
