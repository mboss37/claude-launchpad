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

  it("enables sandbox with failIfUnavailable", () => {
    const settings = generateSettings(baseProject);
    expect(settings.sandbox?.enabled).toBe(true);
    expect(settings.sandbox?.failIfUnavailable).toBe(true);
  });

  it("generates 8 deny rules total", () => {
    const settings = generateSettings(baseProject);
    expect(settings.permissions?.deny).toHaveLength(8);
  });

  it("includes SessionStart hook", () => {
    const settings = generateSettings(baseProject);
    const hooks = settings.hooks as Record<string, unknown[]>;
    expect(hooks.SessionStart).toBeDefined();
    expect(hooks.SessionStart).toHaveLength(1);
  });
});
