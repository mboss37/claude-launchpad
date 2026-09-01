import { describe, expect, it } from "vitest";
import {
  generateCursorEnhanceSkill,
  generateCursorHooks,
  generateCursorReviewer,
  generateCursorRule,
} from "../src/harness/cursor/generators.js";
import { autoFormatScript } from "../src/harness/cursor/hook-scripts.js";
import { fixedDetectedProject } from "./fixtures/detected-project.js";

describe("Cursor generators", () => {
  it("renders Cursor rules with valid MDC frontmatter", () => {
    const content = generateCursorRule({
      description: "Workflow rules",
      globs: "{BACKLOG.md,TASKS.md}",
      alwaysApply: false,
      body: "# Workflow\n- Keep one source of truth",
      marker: "lp-cursor-workflow-version: 1",
    });
    expect(content).toContain("description: Workflow rules");
    expect(content).toContain("globs: {BACKLOG.md,TASKS.md}");
    expect(content).toContain("alwaysApply: false");
    expect(content).toContain("<!-- lp-cursor-workflow-version: 1 -->");
  });

  it("registers auto-format only when a real formatter command exists", () => {
    const ruby = generateCursorHooks({
      ...fixedDetectedProject,
      language: "Ruby",
    });
    expect(
      ruby.hooks.afterFileEdit?.some((hook) =>
        hook.command.includes("auto-format.sh"),
      ),
    ).toBe(true);
    expect(autoFormatScript("Ruby")).toContain("rubocop");

    const unknown = generateCursorHooks({
      ...fixedDetectedProject,
      language: "COBOL",
    });
    expect(
      unknown.hooks.afterFileEdit?.some((hook) =>
        hook.command.includes("auto-format.sh"),
      ),
    ).toBe(false);
    expect(autoFormatScript("COBOL")).toContain("echo '{}'");
    expect(autoFormatScript("COBOL")).not.toContain("rubocop");
    expect(autoFormatScript("COBOL")).not.toContain("prettier");
  });

  it("renders native fail-closed security hooks", () => {
    const hooks = generateCursorHooks(fixedDetectedProject);
    expect(hooks.version).toBe(1);
    expect(hooks.hooks.beforeShellExecution?.[0]?.failClosed).toBe(true);
    expect(hooks.hooks.beforeReadFile?.[0]?.failClosed).toBe(true);
  });

  it("generates a Cursor-native enhance skill with no Claude Code references", () => {
    const skill = generateCursorEnhanceSkill();
    expect(skill).toContain("AGENTS.md");
    expect(skill).toContain(".cursorignore");
    expect(skill).toContain(".cursor/rules/");
    expect(skill).toContain("globs:");
    expect(skill).toContain("doctor --harness cursor");
    // No Claude surface may leak through: these paths/concepts don't exist
    // in a Cursor project and would send the agent to the wrong files.
    expect(skill).not.toContain(".claudeignore");
    expect(skill).not.toContain(".claude/");
    expect(skill).not.toContain("CLAUDE.md");
    expect(skill).not.toContain("settings.json");
    expect(skill).not.toContain("allowed-tools");
    expect(skill).not.toContain("Claude Code");
    expect(skill).not.toContain("paths:");
  });

  it("generates a reviewer agent with no Claude surface references", () => {
    const reviewer = generateCursorReviewer();
    expect(reviewer).toContain("AGENTS.md");
    expect(reviewer).toContain(".cursor/rules/");
    expect(reviewer).not.toContain("CLAUDE.md");
    expect(reviewer).not.toContain(".claude/");
  });
});
