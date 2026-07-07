import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyzePermissions } from "../src/commands/doctor/analyzers/permissions.js";
import type { ClaudeConfig } from "../src/types/index.js";

// isMemoryMcpRegistered reads ~/.claude.json (user scope), so point HOME at an
// empty temp dir — results must not depend on the machine running the tests.
let isolatedHome: string;
let realHome: string | undefined;
beforeAll(async () => {
  isolatedHome = await mkdtemp(join(tmpdir(), "perm-isolated-home-"));
  realHome = process.env.HOME;
  process.env.HOME = isolatedHome;
});
afterAll(async () => {
  if (realHome === undefined) delete process.env.HOME;
  else process.env.HOME = realHome;
  await rm(isolatedHome, { recursive: true, force: true });
});

const analyze = (c: ClaudeConfig): ReturnType<typeof analyzePermissions> =>
  analyzePermissions(c, "/nonexistent");

function makeConfig(overrides: Partial<ClaudeConfig> = {}): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: "# Test\n## Off-Limits\n- Never hardcode secrets",
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

describe("analyzePermissions", () => {
  it("never flags Off-Limits — guardrails intent is the Quality analyzer's job", async () => {
    const result = await analyze(
      makeConfig({
        claudeMdContent: "# Test\nNo off-limits here",
      }),
    );
    expect(result.issues.some((i) => i.message.includes("Off-Limits"))).toBe(
      false,
    );
  });

  it("flags missing force-push protection", async () => {
    const result = await analyze(makeConfig());
    expect(result.issues.some((i) => i.message.includes("force-push"))).toBe(
      true,
    );
  });

  it("does not flag force-push when a push+force hook exists", async () => {
    const result = await analyze(
      makeConfig({
        hooks: [
          {
            event: "PreToolUse",
            type: "command",
            matcher: "Bash",
            command:
              "echo \"$cmd\" | grep -qE 'push.*--force|push.*-f' && exit 2; exit 0",
          },
        ],
      }),
    );
    expect(result.issues.some((i) => i.message.includes("force-push"))).toBe(
      false,
    );
  });

  it("still flags force-push when a hook merely contains the substring 'force'", async () => {
    const result = await analyze(
      makeConfig({
        hooks: [
          {
            event: "PreToolUse",
            type: "command",
            matcher: "Bash",
            command: "enforce lint rules; exit 0",
          },
        ],
      }),
    );
    expect(result.issues.some((i) => i.message.includes("force-push"))).toBe(
      true,
    );
  });

  it("flags blanket Bash in legacy allowedTools", async () => {
    const result = await analyze(
      makeConfig({
        settings: { allowedTools: ["Bash"] },
      }),
    );
    expect(
      result.issues.some((i) => i.message.includes("blanket-allowed")),
    ).toBe(true);
  });

  it("flags missing credential deny rules", async () => {
    const result = await analyze(
      makeConfig({
        settings: { permissions: { deny: ["Read(.env)"] } },
      }),
    );
    expect(
      result.issues.some((i) =>
        i.message.includes("Credential files not blocked"),
      ),
    ).toBe(true);
  });

  it("does not flag when all credential deny rules present", async () => {
    const result = await analyze(
      makeConfig({
        settings: {
          permissions: {
            deny: ["Read(~/.ssh/*)", "Read(~/.aws/*)", "Read(~/.npmrc)"],
          },
        },
      }),
    );
    expect(
      result.issues.some((i) => i.message.includes("Credential files")),
    ).toBe(false);
  });

  it("flags blanket Bash in permissions.allow", async () => {
    const result = await analyze(
      makeConfig({
        settings: { permissions: { allow: ["Bash"] } },
      }),
    );
    expect(
      result.issues.some((i) => i.message.includes("blanket-allowed")),
    ).toBe(true);
  });

  it("does not flag scoped Bash in permissions.allow", async () => {
    const result = await analyze(
      makeConfig({
        settings: { permissions: { allow: ["Bash(npm test)"] } },
      }),
    );
    expect(
      result.issues.some((i) => i.message.includes("blanket-allowed")),
    ).toBe(false);
  });

  it("flags bypass mode not disabled", async () => {
    const result = await analyze(
      makeConfig({
        settings: {},
      }),
    );
    expect(
      result.issues.some((i) => i.message.includes("Bypass permissions mode")),
    ).toBe(true);
  });

  it("does not flag when bypass mode is disabled", async () => {
    const result = await analyze(
      makeConfig({
        settings: { disableBypassPermissionsMode: "disable" },
      }),
    );
    expect(result.issues.some((i) => i.message.includes("Bypass"))).toBe(false);
  });

  it("does not flag an enabled sandbox on its own — it's a first-party security feature", async () => {
    const result = await analyze(
      makeConfig({
        settings: { sandbox: { enabled: true, failIfUnavailable: true } },
      }),
    );
    expect(
      result.issues.some((i) => i.message.toLowerCase().includes("sandbox")),
    ).toBe(false);
  });

  it("flags sandbox without a ~/.agentic-memory write grant when memory MCP is registered", async () => {
    const result = await analyze(
      makeConfig({
        settings: { sandbox: { enabled: true } },
        mcpServers: [
          {
            name: "agentic-memory",
            transport: "stdio",
            command: "npx claude-launchpad memory serve",
          },
        ],
      }),
    );
    const issue = result.issues.find((i) => i.message.includes("write grant"));
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("medium");
    expect(issue?.fix).toContain("allowWrite");
  });

  it("does not flag sandbox when allowWrite already covers ~/.agentic-memory", async () => {
    const result = await analyze(
      makeConfig({
        settings: {
          sandbox: {
            enabled: true,
            filesystem: { allowWrite: ["~/.agentic-memory"] },
          },
        },
        mcpServers: [
          {
            name: "agentic-memory",
            transport: "stdio",
            command: "npx claude-launchpad memory serve",
          },
        ],
      }),
    );
    expect(
      result.issues.some((i) => i.message.toLowerCase().includes("sandbox")),
    ).toBe(false);
  });

  it("does not flag when no sandbox block is present", async () => {
    const result = await analyze(
      makeConfig({
        settings: {},
      }),
    );
    expect(
      result.issues.some((i) => i.message.toLowerCase().includes("sandbox")),
    ).toBe(false);
  });

  it("detects user-scope memory registration (~/.claude.json) for the sandbox check", async () => {
    // Local-placement installs register via `claude mcp add --scope local`,
    // which writes ~/.claude.json — invisible to config.mcpServers.
    const fakeHome = await mkdtemp(join(tmpdir(), "perm-home-"));
    const projectRoot = "/test/project";
    await writeFile(
      join(fakeHome, ".claude.json"),
      JSON.stringify({
        projects: { [projectRoot]: { mcpServers: { "agentic-memory": {} } } },
      }),
    );
    const realHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      const result = await analyzePermissions(
        makeConfig({
          settings: { sandbox: { enabled: true } },
        }),
        projectRoot,
      );
      expect(result.issues.some((i) => i.message.includes("write grant"))).toBe(
        true,
      );
    } finally {
      process.env.HOME = realHome;
      await rm(fakeHome, { recursive: true, force: true });
    }
  });

  it("flags .env gap when hooks protect but claudeignore does not", async () => {
    const result = await analyze(
      makeConfig({
        hooks: [
          {
            event: "PreToolUse",
            type: "command",
            matcher: "Read",
            command: "block .env files",
          },
        ],
        claudeignoreContent: "node_modules\ndist\n",
      }),
    );
    expect(
      result.issues.some((i) =>
        i.message.includes(
          ".env is protected by hooks but not in .claudeignore",
        ),
      ),
    ).toBe(true);
  });

  it("does not flag .env gap when claudeignore contains .env", async () => {
    const result = await analyze(
      makeConfig({
        hooks: [
          {
            event: "PreToolUse",
            type: "command",
            matcher: "Read",
            command: "block .env files",
          },
        ],
        claudeignoreContent: "node_modules\n.env\ndist\n",
      }),
    );
    expect(
      result.issues.some((i) => i.message.includes(".env is protected")),
    ).toBe(false);
  });
});
