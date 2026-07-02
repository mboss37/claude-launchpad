import { describe, it, expect } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeSprintHygieneScripts } from "../src/lib/hook-scripts.js";

async function gitProject(): Promise<{ root: string; openPath: string }> {
  const root = join(tmpdir(), `sprint-open-${randomUUID()}`);
  await mkdir(root, { recursive: true });
  const { openPath } = await writeSprintHygieneScripts(root);
  execFileSync("git", ["init", "-q"], { cwd: root });
  return { root, openPath };
}

function commit(root: string, msg: string): void {
  execFileSync("git", ["add", "-A"], { cwd: root });
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", msg],
    { cwd: root },
  );
}

function runHook(openPath: string, cwd: string, command: string): string {
  return execFileSync("bash", [openPath], {
    cwd,
    input: JSON.stringify({ tool_input: { command } }),
    encoding: "utf-8",
  });
}

describe("sprint-open-check.sh (PostToolUse, inspects the last commit)", () => {
  it("warns via additionalContext JSON when a pull commit deletes nothing from BACKLOG.md", async () => {
    const { root, openPath } = await gitProject();
    await writeFile(
      join(root, "BACKLOG.md"),
      "# Backlog\n\n## P1\n\n### WP-001 — Thing\n",
    );
    await writeFile(join(root, "TASKS.md"), "## Current Sprint\n");
    commit(root, "seed");
    // Pull WITHOUT removing from BACKLOG — the drift this hook exists to catch
    await writeFile(
      join(root, "TASKS.md"),
      "## Current Sprint\n- [ ] WP-001 — Thing\n",
    );
    commit(root, "chore(sprint-1): pull WP-001");

    const stdout = runHook(
      openPath,
      root,
      "git commit -m 'chore(sprint-1): pull WP-001'",
    );
    const parsed = JSON.parse(stdout) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe("PostToolUse");
    expect(parsed.hookSpecificOutput.additionalContext).toContain("--amend");
  });

  it("is silent when the pull commit also deletes the WP from BACKLOG.md", async () => {
    const { root, openPath } = await gitProject();
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

    const stdout = runHook(openPath, root, "git commit -m 'pull'");
    expect(stdout.trim()).toBe("");
  });

  it("ignores non-commit commands and non-pull commits", async () => {
    const { root, openPath } = await gitProject();
    await writeFile(join(root, "TASKS.md"), "## Current Sprint\n");
    commit(root, "seed");

    expect(runHook(openPath, root, "npm test").trim()).toBe("");
    expect(runHook(openPath, root, "git commit -m 'docs only'").trim()).toBe(
      "",
    );
  });

  it("exits 0 outside a git repo", async () => {
    const root = join(tmpdir(), `sprint-open-nogit-${randomUUID()}`);
    await mkdir(root, { recursive: true });
    const { openPath } = await writeSprintHygieneScripts(root);
    const stdout = runHook(openPath, root, "git commit -m x");
    expect(stdout.trim()).toBe("");
  });
});
