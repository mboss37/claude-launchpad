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

/** Warnings must arrive as PostToolUse additionalContext JSON — bare stdout never reaches the model. */
function parseContext(stdout: string): string {
  const parsed = JSON.parse(stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
  expect(parsed.hookSpecificOutput.hookEventName).toBe("PostToolUse");
  return parsed.hookSpecificOutput.additionalContext;
}

const BACKLOG_WITH_WP = (id: string, extra = ""): string =>
  `# Backlog\n\n## P1 — Soon\n\n### ${id} — Some title\n\n- **Priority:** P1\n- **Depends on:** none\n${extra}\n## Changelog\n\n- 2026-07-01: ${id} added (P1)\n`;

describe("workflow-check.sh", () => {
  let root: string;
  let scriptPath: string;

  beforeEach(async () => {
    root = "";
    scriptPath = "";
  });

  it("warns as additionalContext JSON when a WP entry exists in a P-section AND Current Sprint", async () => {
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": BACKLOG_WITH_WP("WP-001"),
      "TASKS.md": "## Current Sprint\n- [ ] WP-001 — Some title\n",
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    const ctx = parseContext(stdout);
    expect(ctx).toContain("WP-001");
    expect(ctx).toMatch(/BOTH|both/);
  });

  it("does NOT warn on a correctly executed sprint pull (ID only in Changelog + Depends on)", async () => {
    // The prescribed pull leaves the ID in BACKLOG's Changelog ("pulled into Sprint N")
    // and possibly in other WPs' "Depends on:" fields. Neither is a violation.
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md":
        "# Backlog\n\n## P1 — Soon\n\n### WP-002 — Other work\n\n- **Priority:** P1\n- **Depends on:** WP-001\n\n## Changelog\n\n- 2026-07-01: WP-001 pulled into Sprint 5\n",
      "TASKS.md": "## Current Sprint\n- [ ] WP-001 — Some title\n\n## Session Log\n- **2026-07-01:** entry\n",
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("catches 4+ digit WP IDs", async () => {
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": BACKLOG_WITH_WP("WP-1000"),
      "TASKS.md": "## Current Sprint\n- [ ] WP-1000 — Some title\n",
    }));
    const { stdout } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(parseContext(stdout)).toContain("WP-1000");
  });

  it("warns when TASKS.md exceeds 80 lines", async () => {
    const longTasks = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": "empty\n",
      "TASKS.md": longTasks,
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    expect(parseContext(stdout)).toContain("under 80");
  });

  it("warns when Current Sprint has more than 15 items (hard split trigger)", async () => {
    const items = Array.from({ length: 16 }, (_, i) => `- [ ] WP-${String(i + 100).padStart(3, "0")} — task`).join("\n");
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": "empty\n",
      "TASKS.md": `## Current Sprint\n${items}\n\n## Completed Sprints\n`,
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    const ctx = parseContext(stdout);
    expect(ctx).toContain("Current Sprint");
    expect(ctx).toContain("16");
  });

  it("warns when Session Log has more than 3 entries", async () => {
    const log = [1, 2, 3, 4].map((i) => `- **2026-05-0${i}:** entry`).join("\n");
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": "empty\n",
      "TASKS.md": `## Current Sprint\n\n## Session Log\n${log}\n`,
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    const ctx = parseContext(stdout);
    expect(ctx).toContain("Session Log");
    expect(ctx).toContain("4");
  });

  it("warns when a pulled WP's dependency still sits in a BACKLOG P-section", async () => {
    ({ root, scriptPath } = await prepareFixture({}));
    const backlogBefore =
      "# Backlog\n\n## P1 — Soon\n\n### WP-010 — Feature\n\n- **Priority:** P1\n- **Depends on:** WP-011\n\n### WP-011 — Prerequisite\n\n- **Priority:** P1\n- **Depends on:** none\n\n## Changelog\n\n- seeded\n";
    await writeFile(join(root, "BACKLOG.md"), backlogBefore);
    await writeFile(join(root, "TASKS.md"), "## Current Sprint\n");
    execFileSync("git", ["init", "-q"], { cwd: root });
    execFileSync("git", ["add", "-A"], { cwd: root });
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "seed"], { cwd: root });
    // Pull WP-010 (which depends on WP-011, still in backlog) — dependency data lives in HEAD:BACKLOG.md
    await writeFile(
      join(root, "BACKLOG.md"),
      "# Backlog\n\n## P1 — Soon\n\n### WP-011 — Prerequisite\n\n- **Priority:** P1\n- **Depends on:** none\n\n## Changelog\n\n- 2026-07-02: WP-010 pulled into Sprint 1\n",
    );
    await writeFile(join(root, "TASKS.md"), "## Current Sprint\n- [ ] WP-010 — Feature\n");
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    const ctx = parseContext(stdout);
    expect(ctx).toContain("WP-010");
    expect(ctx).toContain("WP-011");
    expect(ctx.toLowerCase()).toContain("dependen");
  });

  it("is silent when everything is healthy", async () => {
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": BACKLOG_WITH_WP("WP-002"),
      "TASKS.md": "## Current Sprint\n- [ ] WP-001 — only in tasks\n\n## Completed Sprints\n\n## Session Log\n- **2026-05-04:** first entry\n",
    }));
    const { stdout, exitCode } = runHook(scriptPath, root, join(root, "TASKS.md"));
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("exits without acting when the edit path is not BACKLOG/TASKS", async () => {
    ({ root, scriptPath } = await prepareFixture({
      "BACKLOG.md": BACKLOG_WITH_WP("WP-001"),
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
