import { describe, expect, it } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeCursorHookScripts } from "../src/harness/cursor/hook-scripts.js";

async function gitProject(): Promise<string> {
  const root = join(tmpdir(), `cursor-hooks-${randomUUID()}`);
  await mkdir(root, { recursive: true });
  await writeCursorHookScripts(root, "TypeScript");
  execFileSync("git", ["init", "-q"], { cwd: root });
  return root;
}

function commit(root: string, msg: string): void {
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", msg],
    { cwd: root },
  );
}

function runHook(
  root: string,
  script: string,
  input: Record<string, unknown>,
): string {
  return execFileSync("bash", [join(root, ".cursor", "hooks", script)], {
    cwd: root,
    input: JSON.stringify(input),
    encoding: "utf-8",
  }).trim();
}

describe("Cursor sprint-open.sh (afterShellExecution, inspects the last commit)", () => {
  it("warns when a pull commit deletes nothing from BACKLOG.md", async () => {
    const root = await gitProject();
    await writeFile(
      join(root, "BACKLOG.md"),
      "# Backlog\n\n## P1\n\n### WP-001 — Thing\n",
    );
    await writeFile(join(root, "TASKS.md"), "## Current Sprint\n");
    commit(root, "seed");
    await writeFile(
      join(root, "TASKS.md"),
      "## Current Sprint\n- [ ] WP-001 — Thing\n",
    );
    commit(root, "chore(sprint-1): pull WP-001");

    const stdout = runHook(root, "sprint-open.sh", {
      command: "git commit -m 'chore(sprint-1): pull WP-001'",
    });
    const parsed = JSON.parse(stdout) as { additional_context?: string };
    expect(parsed.additional_context).toContain("--amend");
  });

  it("is silent when the pull commit also deletes the WP from BACKLOG.md", async () => {
    const root = await gitProject();
    await writeFile(
      join(root, "BACKLOG.md"),
      "# Backlog\n\n## P1\n\n### WP-001 — Thing\n",
    );
    await writeFile(join(root, "TASKS.md"), "## Current Sprint\n");
    commit(root, "seed");
    await writeFile(join(root, "BACKLOG.md"), "# Backlog\n\n## P1\n");
    await writeFile(
      join(root, "TASKS.md"),
      "## Current Sprint\n- [ ] WP-001 — Thing\n",
    );
    commit(root, "chore(sprint-1): pull WP-001");

    expect(
      runHook(root, "sprint-open.sh", { command: "git commit -m x" }),
    ).toBe("{}");
  });

  it("ignores non-commit commands", async () => {
    const root = await gitProject();
    await writeFile(join(root, "TASKS.md"), "## Current Sprint\n");
    commit(root, "seed");
    expect(runHook(root, "sprint-open.sh", { command: "npm test" })).toBe("{}");
  });
});

describe("Cursor sprint-size.sh (sessionStart)", () => {
  async function projectWithTasks(tasks: string): Promise<string> {
    const root = join(tmpdir(), `cursor-size-${randomUUID()}`);
    await mkdir(root, { recursive: true });
    await writeCursorHookScripts(root, "TypeScript");
    await writeFile(join(root, "TASKS.md"), tasks);
    return root;
  }

  it("warns when Current Sprint has no work packages", async () => {
    const root = await projectWithTasks(
      "## Current Sprint\n\n## Session Log\n",
    );
    const parsed = JSON.parse(runHook(root, "sprint-size.sh", {})) as {
      additional_context?: string;
    };
    expect(parsed.additional_context).toMatch(/no work packages/i);
  });

  it("warns when Current Sprint is oversized", async () => {
    const items = Array.from(
      { length: 8 },
      (_, i) => `- [ ] WP-00${i + 1} — x`,
    ).join("\n");
    const root = await projectWithTasks(`## Current Sprint\n${items}\n`);
    const parsed = JSON.parse(runHook(root, "sprint-size.sh", {})) as {
      additional_context?: string;
    };
    expect(parsed.additional_context).toMatch(/oversized/i);
  });

  it("is silent in the 3-6 sweet spot", async () => {
    const items = Array.from(
      { length: 4 },
      (_, i) => `- [ ] WP-00${i + 1} — x`,
    ).join("\n");
    const root = await projectWithTasks(`## Current Sprint\n${items}\n`);
    expect(runHook(root, "sprint-size.sh", {})).toBe("{}");
  });
});

describe("Cursor workflow-check.sh (afterFileEdit)", () => {
  it("only acts on BACKLOG.md / TASKS.md edits", async () => {
    const root = await gitProject();
    await writeFile(
      join(root, "BACKLOG.md"),
      "## P1\n\n### WP-001 — Thing\n\n## Changelog\n",
    );
    await writeFile(
      join(root, "TASKS.md"),
      "## Current Sprint\n- [ ] WP-001 — Thing\n",
    );
    expect(
      runHook(root, "workflow-check.sh", { file_path: "src/index.ts" }),
    ).toBe("{}");
  });

  it("does not warn when the WP only appears in the BACKLOG Changelog", async () => {
    const root = await gitProject();
    await writeFile(
      join(root, "BACKLOG.md"),
      [
        "# Backlog",
        "",
        "## P1",
        "",
        "## Changelog",
        "",
        "2026-08-30: WP-012 pulled into Sprint 3",
        "",
      ].join("\n"),
    );
    await writeFile(
      join(root, "TASKS.md"),
      "## Current Sprint\n- [ ] WP-012 — Thing\n",
    );
    expect(runHook(root, "workflow-check.sh", { file_path: "TASKS.md" })).toBe(
      "{}",
    );
  });

  it("warns when a WP entry lives in a P-section AND the Current Sprint", async () => {
    const root = await gitProject();
    await writeFile(
      join(root, "BACKLOG.md"),
      "# Backlog\n\n## P1\n\n### WP-012 — Thing\n\n## Changelog\n",
    );
    await writeFile(
      join(root, "TASKS.md"),
      "## Current Sprint\n- [ ] WP-012 — Thing\n",
    );
    const stdout = runHook(root, "workflow-check.sh", {
      file_path: "TASKS.md",
    });
    const parsed = JSON.parse(stdout) as { additional_context?: string };
    expect(parsed.additional_context).toContain("WP-012");
    expect(parsed.additional_context).toContain("move-not-copy");
  });
});
