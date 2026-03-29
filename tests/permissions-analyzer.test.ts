import { describe, it, expect } from "vitest";
import { analyzePermissions } from "../src/commands/doctor/analyzers/permissions.js";
import type { ClaudeConfig } from "../src/types/index.js";

function makeConfig(overrides: Partial<ClaudeConfig> = {}): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: "# Test\n## Off-Limits\n- Never hardcode secrets",
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

describe("analyzePermissions", () => {
  it("flags missing Off-Limits section", async () => {
    const result = await analyzePermissions(makeConfig({
      claudeMdContent: "# Test\nNo off-limits here",
    }));
    expect(result.issues.some((i) => i.message.includes("Off-Limits"))).toBe(true);
  });

  it("does not flag when Off-Limits section exists", async () => {
    const result = await analyzePermissions(makeConfig());
    expect(result.issues.some((i) => i.message.includes("Off-Limits"))).toBe(false);
  });

  it("flags missing force-push protection", async () => {
    const result = await analyzePermissions(makeConfig());
    expect(result.issues.some((i) => i.message.includes("force-push"))).toBe(true);
  });

  it("does not flag force-push when hook exists", async () => {
    const result = await analyzePermissions(makeConfig({
      hooks: [{ event: "PreToolUse", type: "command", matcher: "Bash", command: "check force push" }],
    }));
    expect(result.issues.some((i) => i.message.includes("force-push"))).toBe(false);
  });

  it("flags auto-allowed Bash without security hook", async () => {
    const result = await analyzePermissions(makeConfig({
      settings: { allowedTools: ["Bash"] },
    }));
    expect(result.issues.some((i) => i.message.includes("auto-allowed"))).toBe(true);
  });

  it("flags missing credential deny rules", async () => {
    const result = await analyzePermissions(makeConfig({
      settings: { permissions: { deny: ["Read(.env)"] } },
    }));
    expect(result.issues.some((i) => i.message.includes("Credential files not blocked"))).toBe(true);
  });

  it("does not flag when all credential deny rules present", async () => {
    const result = await analyzePermissions(makeConfig({
      settings: { permissions: { deny: ["Read(~/.ssh/*)", "Read(~/.aws/*)", "Read(~/.npmrc)"] } },
    }));
    expect(result.issues.some((i) => i.message.includes("Credential files"))).toBe(false);
  });

  it("flags blanket Bash in permissions.allow", async () => {
    const result = await analyzePermissions(makeConfig({
      settings: { permissions: { allow: ["Bash"] } },
    }));
    expect(result.issues.some((i) => i.message.includes("blanket-allowed"))).toBe(true);
  });

  it("does not flag scoped Bash in permissions.allow", async () => {
    const result = await analyzePermissions(makeConfig({
      settings: { permissions: { allow: ["Bash(npm test)"] } },
    }));
    expect(result.issues.some((i) => i.message.includes("blanket-allowed"))).toBe(false);
  });

  it("flags bypass mode not disabled", async () => {
    const result = await analyzePermissions(makeConfig({
      settings: {},
    }));
    expect(result.issues.some((i) => i.message.includes("Bypass permissions mode"))).toBe(true);
  });

  it("does not flag when bypass mode is disabled", async () => {
    const result = await analyzePermissions(makeConfig({
      settings: { disableBypassPermissionsMode: "disable" },
    }));
    expect(result.issues.some((i) => i.message.includes("Bypass"))).toBe(false);
  });

  it("flags sandbox not enabled", async () => {
    const result = await analyzePermissions(makeConfig({
      settings: {},
    }));
    expect(result.issues.some((i) => i.message.includes("Sandbox not enabled"))).toBe(true);
  });

  it("does not flag when sandbox is enabled", async () => {
    const result = await analyzePermissions(makeConfig({
      settings: { sandbox: { enabled: true } },
    }));
    expect(result.issues.some((i) => i.message.includes("Sandbox"))).toBe(false);
  });

  it("flags .env gap when hooks protect but claudeignore does not", async () => {
    const result = await analyzePermissions(makeConfig({
      hooks: [{ event: "PreToolUse", type: "command", matcher: "Read", command: "block .env files" }],
      claudeignoreContent: "node_modules\ndist\n",
    }));
    expect(result.issues.some((i) => i.message.includes(".env is protected by hooks but not in .claudeignore"))).toBe(true);
  });

  it("does not flag .env gap when claudeignore contains .env", async () => {
    const result = await analyzePermissions(makeConfig({
      hooks: [{ event: "PreToolUse", type: "command", matcher: "Read", command: "block .env files" }],
      claudeignoreContent: "node_modules\n.env\ndist\n",
    }));
    expect(result.issues.some((i) => i.message.includes(".env is protected"))).toBe(false);
  });
});
