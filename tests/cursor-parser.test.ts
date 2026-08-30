import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCursorConfig } from "../src/harness/cursor/parser.js";

describe("parseCursorConfig", () => {
  it("reads instructions, rules, skills, agents, hooks, MCP, and ignore policy", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-parser-"));
    await mkdir(join(root, ".cursor", "rules"), { recursive: true });
    await mkdir(join(root, ".cursor", "skills", "demo"), { recursive: true });
    await mkdir(join(root, ".cursor", "agents"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# Demo\n- Run tests");
    await writeFile(
      join(root, ".cursor", "rules", "core.mdc"),
      "---\nalwaysApply: true\n---\n# Core",
    );
    await writeFile(
      join(root, ".cursor", "skills", "demo", "SKILL.md"),
      "---\nname: demo\ndescription: Demo\n---\n",
    );
    await writeFile(
      join(root, ".cursor", "agents", "reviewer.md"),
      "---\nname: reviewer\ndescription: Review\n---\n",
    );
    await writeFile(
      join(root, ".cursor", "hooks.json"),
      JSON.stringify({
        version: 1,
        hooks: {
          beforeShellExecution: [
            { command: ".cursor/hooks/guard.sh", failClosed: true },
          ],
        },
      }),
    );
    await writeFile(
      join(root, ".cursor", "mcp.json"),
      JSON.stringify({
        mcpServers: {
          memory: {
            command: "npx",
            args: ["claude-launchpad", "memory", "serve"],
          },
        },
      }),
    );
    await writeFile(join(root, ".cursorignore"), ".env\n");

    const config = await parseCursorConfig(root);
    expect(config.instructionsContent).toContain("Run tests");
    expect(config.rules).toHaveLength(1);
    expect(config.skills).toHaveLength(1);
    expect(config.agents).toHaveLength(1);
    expect(config.hooks[0]).toMatchObject({
      event: "beforeShellExecution",
      command: ".cursor/hooks/guard.sh",
      failClosed: true,
    });
    expect(config.mcpServers[0]?.name).toBe("memory");
    expect(config.ignoreContent).toContain(".env");
  });

  it("returns null or empty collections for a partial project", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-partial-"));
    expect(await parseCursorConfig(root)).toMatchObject({
      instructionsContent: null,
      hooks: [],
      rules: [],
      skills: [],
      agents: [],
      mcpServers: [],
      parseErrors: [],
    });
  });

  it("records malformed JSON instead of treating it as absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-invalid-"));
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, ".cursor", "hooks.json"), "{ invalid");
    const config = await parseCursorConfig(root);
    expect(config.parseErrors).toEqual([
      {
        path: ".cursor/hooks.json",
        message: "Invalid JSON",
      },
    ]);
  });
});
