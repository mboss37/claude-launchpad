import { describe, expect, it } from "vitest";
import {
  generateCursorHooks,
  generateCursorRule,
} from "../src/harness/cursor/generators.js";
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

  it("renders native fail-closed security hooks", () => {
    const hooks = generateCursorHooks(fixedDetectedProject);
    expect(hooks.version).toBe(1);
    expect(hooks.hooks.beforeShellExecution?.[0]?.failClosed).toBe(true);
    expect(hooks.hooks.beforeReadFile?.[0]?.failClosed).toBe(true);
  });
});
