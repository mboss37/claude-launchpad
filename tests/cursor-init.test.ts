import { describe, expect, it } from "vitest";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileExists } from "../src/lib/fs-utils.js";
import { scaffoldCursor } from "../src/harness/cursor/scaffold.js";
import { runInit } from "../src/commands/init/index.js";
import { fixedDetectedProject } from "./fixtures/detected-project.js";

const CURSOR_FILES = [
  "AGENTS.md",
  "TASKS.md",
  "BACKLOG.md",
  ".cursor/hooks.json",
  ".cursorignore",
  ".cursor/rules/conventions.mdc",
  ".cursor/rules/workflow.mdc",
  ".cursor/rules/hooks.mdc",
  ".cursor/rules/verification.mdc",
  ".cursor/agents/code-reviewer.md",
  ".cursor/skills/lp-enhance/SKILL.md",
] as const;

describe("Cursor init scaffold", () => {
  it("creates the complete Cursor surface without Claude files", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-init-"));
    await scaffoldCursor(
      root,
      { name: "demo", description: "" },
      fixedDetectedProject,
    );
    await Promise.all(CURSOR_FILES.map((path) => access(join(root, path))));
    expect(await fileExists(join(root, "CLAUDE.md"))).toBe(false);
  });

  it("preserves existing unmarked Cursor files", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-preserve-"));
    await writeFile(join(root, "AGENTS.md"), "# User-authored\n");
    const result = await scaffoldCursor(
      root,
      { name: "demo", description: "" },
      fixedDetectedProject,
    );
    expect(result.preserved).toContain("AGENTS.md");
    expect(await readFile(join(root, "AGENTS.md"), "utf-8")).toBe(
      "# User-authored\n",
    );
  });

  it("is idempotent on a second run", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-idempotent-"));
    const first = await scaffoldCursor(
      root,
      { name: "demo", description: "" },
      fixedDetectedProject,
    );
    const second = await scaffoldCursor(
      root,
      { name: "demo", description: "" },
      fixedDetectedProject,
    );
    expect(first.created.length).toBeGreaterThan(0);
    expect(second.created).toEqual([]);
  });

  it("restores a deleted hook script while preserving customized ones", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-scripts-"));
    await scaffoldCursor(
      root,
      { name: "demo", description: "" },
      fixedDetectedProject,
    );
    const destructive = join(root, ".cursor", "hooks", "destructive-shell.sh");
    const workflow = join(root, ".cursor", "hooks", "workflow-check.sh");
    await rm(destructive);
    await writeFile(workflow, "#!/usr/bin/env bash\n# customized\nexit 0\n");

    const result = await scaffoldCursor(
      root,
      { name: "demo", description: "" },
      fixedDetectedProject,
    );
    expect(result.created).toContain(".cursor/hooks/destructive-shell.sh");
    expect(result.preserved).toContain(".cursor/hooks/workflow-check.sh");
    expect(await fileExists(destructive)).toBe(true);
    expect(await readFile(workflow, "utf-8")).toContain("# customized");
  });

  it("overwrites AGENTS.md with --force but nothing else", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-force-"));
    await writeFile(join(root, "AGENTS.md"), "# User-authored\n");
    await writeFile(join(root, "TASKS.md"), "# My tasks\n");
    const result = await scaffoldCursor(
      root,
      { name: "demo", description: "", force: true },
      fixedDetectedProject,
    );
    expect(result.created).toContain("AGENTS.md");
    expect(await readFile(join(root, "AGENTS.md"), "utf-8")).not.toContain(
      "User-authored",
    );
    expect(await readFile(join(root, "TASKS.md"), "utf-8")).toBe(
      "# My tasks\n",
    );
  });

  it("Cursor-only scaffold has no Claude surface leftovers", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-honest-"));
    await scaffoldCursor(
      root,
      { name: "demo", description: "" },
      fixedDetectedProject,
    );
    const files = [
      "AGENTS.md",
      "TASKS.md",
      "BACKLOG.md",
      ".cursor/rules/hooks.mdc",
      ".cursor/rules/workflow.mdc",
      ".cursor/agents/code-reviewer.md",
    ];
    for (const relative of files) {
      const body = await readFile(join(root, relative), "utf-8");
      expect(body, relative).not.toContain(".claude/");
      expect(body, relative).not.toContain("CLAUDE.md");
      expect(body, relative).not.toContain("Claude Code");
    }
  });
});

describe("init harness selection", () => {
  it("defaults to Claude-only output", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-init-claude-"));
    await runInit(
      root,
      {
        name: "demo",
        description: "",
        harness: "claude",
        yes: true,
      },
      fixedDetectedProject,
    );
    expect(await fileExists(join(root, "CLAUDE.md"))).toBe(true);
    expect(await fileExists(join(root, "AGENTS.md"))).toBe(false);
  });

  it("creates both surfaces and shared TASKS/BACKLOG once", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-init-both-"));
    await runInit(
      root,
      {
        name: "demo",
        description: "",
        harness: "both",
        yes: true,
      },
      fixedDetectedProject,
    );
    expect(await fileExists(join(root, "CLAUDE.md"))).toBe(true);
    expect(await fileExists(join(root, "AGENTS.md"))).toBe(true);
    expect(await fileExists(join(root, "TASKS.md"))).toBe(true);
    expect(await fileExists(join(root, "BACKLOG.md"))).toBe(true);
    expect(await fileExists(join(root, ".claude", "settings.json"))).toBe(true);
    expect(await fileExists(join(root, ".cursor", "hooks.json"))).toBe(true);
  });

  it("rejects auto for init", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-init-auto-"));
    await mkdir(root, { recursive: true });
    await expect(
      runInit(
        root,
        {
          name: "demo",
          description: "",
          harness: "auto",
          yes: true,
        },
        fixedDetectedProject,
      ),
    ).rejects.toThrow("init does not accept --harness auto");
  });
});
