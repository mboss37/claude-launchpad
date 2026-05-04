import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeWorkflowCheckScript } from "../src/lib/hook-scripts.js";

async function prepareFixture(files: Record<string, string>): Promise<{ root: string; scriptPath: string }> {
  const root = join(tmpdir(), `workflow-hook-${randomUUID()}`);
  await mkdir(root, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    await writeFile(join(root, rel), content);
  }
  const scriptPath = await writeWorkflowCheckScript(root);
  return { root, scriptPath };
}

function runHook(scriptPath: string, cwd: string, filePath: string): { stdout: string; exitCode: number } {
  const fakeInput = JSON.stringify({ tool_input: { file_path: filePath } });
  try {
    const stdout = execFileSync("bash", [scriptPath], {
      cwd,
      input: fakeInput,
      encoding: "utf-8",
    });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string | Buffer; status?: number };
    const stdout = typeof e.stdout === "string" ? e.stdout : e.stdout?.toString() ?? "";
    return { stdout, exitCode: e.status ?? 1 };
  }
}

describe("workflow-check.sh", () => {
  let root: string;
  let scriptPath: string;

  beforeEach(async () => {
    // noop, populated per-test
    root = "";
    scriptPath = "";
  });

  it("warns when a WP ID exists in both BACKLOG.md and TASKS.md", async () => {
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": "### WP-001 — Some title\n- Priority: P1\n",
      "TASKS.md": "## Current Sprint\n- [ ] WP-001 — Some title\n",
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    expect(stdout).toContain("WP-001");
    expect(stdout).toMatch(/BOTH|both/);
  });

  it("warns when TASKS.md exceeds 80 lines", async () => {
    const longTasks = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": "empty\n",
      "TASKS.md": longTasks,
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    expect(stdout).toContain("under 80");
  });

  it("warns when Current Sprint has more than 15 items", async () => {
    const items = Array.from({ length: 16 }, (_, i) => `- [ ] WP-${String(i + 100).padStart(3, "0")} — task`).join("\n");
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": "empty\n",
      "TASKS.md": `## Current Sprint\n${items}\n\n## Completed Sprints\n`,
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Current Sprint");
    expect(stdout).toContain("16");
  });

  it("warns when Session Log has more than 3 entries", async () => {
    const log = [1, 2, 3, 4].map((i) => `- **2026-05-0${i}:** entry`).join("\n");
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": "empty\n",
      "TASKS.md": `## Current Sprint\n\n## Session Log\n${log}\n`,
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Session Log");
    expect(stdout).toContain("4");
  });

  it("is silent when everything is healthy", async () => {
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": "### WP-002 — only in backlog\n- Priority: P1\n",
      "TASKS.md": "## Current Sprint\n- [ ] WP-001 — only in tasks\n\n## Completed Sprints\n\n## Session Log\n- **2026-05-04:** first entry\n",
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("exits without acting when the edit path is not BACKLOG/TASKS", async () => {
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": "### WP-001 — dup\n",
      "TASKS.md": "- [ ] WP-001 — dup\n",
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "README.md"));
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("always exits 0 (non-blocking)", async () => {
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": "malformed content\n",
      "TASKS.md": "also malformed\n",
    }));
    const { exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
  });
});
