import { describe, expect, it } from "vitest";
import { mkdir, writeFile, rm, mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileExists } from "../src/lib/fs-utils.js";
import {
  assertNoLiteralSecrets,
  createEvalSandbox,
} from "../src/commands/eval/sandbox.js";
import { claudeEvalRuntime } from "../src/commands/eval/runtimes/claude.js";
import { cursorEvalRuntime } from "../src/commands/eval/runtimes/cursor.js";
import type { EvalScenario } from "../src/types/index.js";

const SCENARIO: EvalScenario = {
  name: "sandbox-copy",
  description: "copy project config into an eval sandbox",
  setup: {
    files: [{ path: "src/app.ts", content: "export const ok = true;\n" }],
    instructions: "Follow the project rules.",
  },
  prompt: "do the task",
  checks: [],
  passingScore: 1,
  runs: 1,
};

const SECRET_KEYS = [
  "token",
  "secret",
  "password",
  "authorization",
  "apiKey",
  "API_KEY",
  "api-key",
] as const;

async function seedProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lp-eval-project-"));
  await mkdir(join(root, ".claude", "rules"), { recursive: true });
  await mkdir(join(root, ".cursor", "hooks"), { recursive: true });
  await mkdir(join(root, ".cursor", "rules"), { recursive: true });
  await mkdir(join(root, ".cursor", "skills"), { recursive: true });
  await mkdir(join(root, ".cursor", "agents"), { recursive: true });
  await writeFile(join(root, ".claude", "settings.json"), "{}\n");
  await writeFile(
    join(root, ".claude", "settings.local.json"),
    '{"danger":true}\n',
  );
  await writeFile(
    join(root, ".claude", "rules", "workflow.md"),
    "# workflow\n",
  );
  await writeFile(join(root, ".claudeignore"), "node_modules\n");
  await writeFile(join(root, "CLAUDE.md"), "# Project\n");
  await writeFile(join(root, "AGENTS.md"), "# Agents\n");
  await writeFile(
    join(root, ".cursor", "hooks.json"),
    JSON.stringify({ hooks: {} }),
  );
  await writeFile(
    join(root, ".cursor", "hooks", "env-read.sh"),
    "#!/bin/bash\n",
  );
  await writeFile(join(root, ".cursor", "rules", "style.mdc"), "# style\n");
  await writeFile(join(root, ".cursor", "skills", "review.md"), "# skill\n");
  await writeFile(join(root, ".cursor", "agents", "reviewer.md"), "# agent\n");
  await writeFile(
    join(root, ".cursor", "mcp.json"),
    JSON.stringify({ mcpServers: { memory: { command: "npx" } } }),
  );
  await writeFile(join(root, ".cursorignore"), ".env\n");
  await writeFile(
    join(root, ".cursor", "sandbox.json"),
    '{"type":"workspace"}\n',
  );
  await writeFile(
    join(root, ".cursor", "cli.json"),
    '{"permissions":{"allow":["Shell(node:*)"],"deny":[]}}\n',
  );
  await writeFile(
    join(root, ".cursor", "settings.local.json"),
    '{"user":true}\n',
  );
  return root;
}

describe("createEvalSandbox", () => {
  it("copies Claude project files and not Cursor hooks", async () => {
    const projectRoot = await seedProject();
    let sandbox = "";
    try {
      sandbox = await createEvalSandbox(
        claudeEvalRuntime,
        SCENARIO,
        projectRoot,
      );
      expect(await fileExists(join(sandbox, "src/app.ts"))).toBe(true);
      expect(await fileExists(join(sandbox, "CLAUDE.md"))).toBe(true);
      expect(await fileExists(join(sandbox, ".claude/settings.json"))).toBe(
        true,
      );
      expect(await fileExists(join(sandbox, ".claude/rules/workflow.md"))).toBe(
        true,
      );
      expect(await fileExists(join(sandbox, ".claudeignore"))).toBe(true);
      expect(
        await fileExists(join(sandbox, ".claude/settings.local.json")),
      ).toBe(false);
      expect(await fileExists(join(sandbox, ".cursor/hooks.json"))).toBe(false);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
      if (sandbox) await rm(sandbox, { recursive: true, force: true });
    }
  });

  it("copies Cursor project files and not Claude settings", async () => {
    const projectRoot = await seedProject();
    let sandbox = "";
    try {
      sandbox = await createEvalSandbox(
        cursorEvalRuntime,
        SCENARIO,
        projectRoot,
      );
      expect(await fileExists(join(sandbox, "AGENTS.md"))).toBe(true);
      const instructions = await readFile(join(sandbox, "AGENTS.md"), "utf-8");
      expect(instructions).toContain("# Agents");
      expect(instructions).toContain("Follow the project rules.");
      expect(await fileExists(join(sandbox, ".cursor/hooks.json"))).toBe(true);
      expect(await fileExists(join(sandbox, ".cursor/hooks/env-read.sh"))).toBe(
        true,
      );
      expect(await fileExists(join(sandbox, ".cursor/rules/style.mdc"))).toBe(
        true,
      );
      expect(await fileExists(join(sandbox, ".cursor/skills/review.md"))).toBe(
        true,
      );
      expect(
        await fileExists(join(sandbox, ".cursor/agents/reviewer.md")),
      ).toBe(true);
      expect(await fileExists(join(sandbox, ".cursor/mcp.json"))).toBe(true);
      expect(await fileExists(join(sandbox, ".cursorignore"))).toBe(true);
      expect(await fileExists(join(sandbox, ".cursor/sandbox.json"))).toBe(
        true,
      );
      expect(await fileExists(join(sandbox, ".cursor/cli.json"))).toBe(true);
      expect(
        await fileExists(join(sandbox, ".cursor/settings.local.json")),
      ).toBe(false);
      expect(await fileExists(join(sandbox, ".claude/settings.json"))).toBe(
        false,
      );
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
      if (sandbox) await rm(sandbox, { recursive: true, force: true });
    }
  });

  it.each(SECRET_KEYS)(
    "rejects an MCP literal %s and permits an env reference",
    async (key) => {
      const projectRoot = await seedProject();
      let sandbox = "";
      try {
        await writeFile(
          join(projectRoot, ".cursor", "mcp.json"),
          JSON.stringify({
            mcpServers: { bad: { env: { [key]: "literal-secret" } } },
          }),
        );
        await expect(
          createEvalSandbox(cursorEvalRuntime, SCENARIO, projectRoot),
        ).rejects.toThrow(new RegExp(key, "i"));

        await writeFile(
          join(projectRoot, ".cursor", "mcp.json"),
          JSON.stringify({
            mcpServers: { ok: { env: { [key]: "${CURSOR_API_KEY}" } } },
          }),
        );
        sandbox = await createEvalSandbox(
          cursorEvalRuntime,
          SCENARIO,
          projectRoot,
        );
        expect(await fileExists(join(sandbox, ".cursor/mcp.json"))).toBe(true);
      } finally {
        await rm(projectRoot, { recursive: true, force: true });
        if (sandbox) await rm(sandbox, { recursive: true, force: true });
      }
    },
  );

  it("rejects nested and non-string values under secret-bearing keys", () => {
    expect(() =>
      assertNoLiteralSecrets(
        { clientSecret: { value: "literal-secret" } },
        ".cursor/mcp.json",
      ),
    ).toThrow(/clientSecret/);
    expect(() =>
      assertNoLiteralSecrets(
        { apiKey: ["literal-secret"] },
        ".cursor/mcp.json",
      ),
    ).toThrow(/apiKey/);
    expect(() =>
      assertNoLiteralSecrets({ token: 1234 }, ".cursor/mcp.json"),
    ).toThrow(/token/);
  });
});
