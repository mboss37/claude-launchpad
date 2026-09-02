import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AnalyzerResult, DiagnosticIssue } from "../src/types/index.js";
import { parseCursorConfig } from "../src/harness/cursor/parser.js";
import { runCursorAnalyzers } from "../src/harness/cursor/doctor.js";
import { scaffoldCursor } from "../src/harness/cursor/scaffold.js";
import { applyCursorReportFixes } from "../src/commands/doctor/index.js";
import { applyCursorFixes } from "../src/harness/cursor/fixer.js";
import { fixedDetectedProject } from "./fixtures/detected-project.js";

function findIssue(
  results: ReadonlyArray<AnalyzerResult>,
  analyzer: string,
  message: string,
): DiagnosticIssue | undefined {
  return results
    .flatMap((result) => result.issues)
    .find(
      (issue) => issue.analyzer === analyzer && issue.message.includes(message),
    );
}

describe("Cursor doctor", () => {
  it("flags the core Cursor configuration gaps", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-doctor-"));
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(
      join(root, ".cursor", "hooks.json"),
      JSON.stringify({
        version: 1,
        hooks: {
          beforeReadFile: [
            { command: ".cursor/hooks/env-read.sh", failClosed: false },
          ],
          beforeShellExecution: [
            {
              command: ".cursor/hooks/destructive-shell.sh",
              failClosed: false,
            },
          ],
        },
      }),
    );
    await writeFile(
      join(root, ".cursor", "mcp.json"),
      JSON.stringify({ mcpServers: { broken: { transport: "stdio" } } }),
    );
    await writeFile(join(root, ".cursorignore"), "node_modules/\n");

    const result = await runCursorAnalyzers(
      await parseCursorConfig(root),
      root,
    );
    expect(findIssue(result, "Instructions", "No AGENTS.md")?.severity).toBe(
      "high",
    );
    expect(
      findIssue(result, "Hooks", "security hook is not fail-closed")?.severity,
    ).toBe("high");
    expect(
      findIssue(result, "Rules", "No .cursor/rules/verification.mdc")?.severity,
    ).toBe("medium");
    expect(
      findIssue(result, "Security", ".env is missing from .cursorignore")
        ?.severity,
    ).toBe("medium");
    expect(
      findIssue(result, "MCP", "stdio transport but has no command")?.severity,
    ).toBe("high");
    expect(
      result
        .flatMap((entry) => entry.issues)
        .some((issue) => issue.message.includes("Claude")),
    ).toBe(false);
  });

  it("scores a scaffolded Cursor project with no actionable issues", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-healthy-"));
    await scaffoldCursor(
      root,
      { name: "demo", description: "" },
      fixedDetectedProject,
    );
    const result = await runCursorAnalyzers(
      await parseCursorConfig(root),
      root,
    );
    const actionable = result
      .flatMap((entry) => entry.issues)
      .filter((issue) => issue.severity !== "info");
    expect(actionable).toEqual([]);
    const overall = Math.round(
      result.reduce((sum, entry) => sum + entry.score, 0) / result.length,
    );
    expect(overall).toBe(100);
  });

  it("applies Cursor --fix to a broken project", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-fix-"));
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# Demo\n- Use tests\n");
    const before = await runCursorAnalyzers(
      await parseCursorConfig(root),
      root,
    );
    const { written } = await applyCursorReportFixes(before, root, false);
    expect(written).toBe(true);
    expect(
      await runCursorAnalyzers(await parseCursorConfig(root), root),
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Rules" })]),
    );
    const after = await applyCursorFixes(
      [
        {
          analyzer: "Rules",
          message: "No .cursor/rules/verification.mdc",
          severity: "medium",
        },
      ],
      root,
    );
    expect(after.fixed).toBe(0);
  });

  it("dry-run lists Cursor fixes without writing", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-dry-"));
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# Demo\n");
    const results = await runCursorAnalyzers(
      await parseCursorConfig(root),
      root,
    );
    const { written, preview } = await applyCursorReportFixes(
      results,
      root,
      true,
    );
    expect(written).toBe(false);
    expect(preview.length).toBeGreaterThan(0);
    expect(
      findIssue(results, "Rules", "No .cursor/rules/verification.mdc"),
    ).toBeDefined();
    const stillMissing = await runCursorAnalyzers(
      await parseCursorConfig(root),
      root,
    );
    expect(
      findIssue(stillMissing, "Rules", "No .cursor/rules/verification.mdc"),
    ).toBeDefined();
  });

  it("flags missing Launchpad security hooks on a partial hooks.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-partial-hooks-"));
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# Demo\n- Use tests\n");
    await writeFile(
      join(root, ".cursor", "hooks.json"),
      JSON.stringify({
        version: 1,
        hooks: { afterFileEdit: [{ command: "./lint.sh" }] },
      }),
    );
    const result = await runCursorAnalyzers(
      await parseCursorConfig(root),
      root,
    );
    expect(
      findIssue(result, "Hooks", "missing .env read protection")?.severity,
    ).toBe("high");
    expect(
      findIssue(result, "Hooks", "missing destructive-shell protection")
        ?.severity,
    ).toBe("high");
    await applyCursorFixes(
      result.flatMap((entry) => entry.issues),
      root,
    );
    const after = JSON.parse(
      await readFile(join(root, ".cursor", "hooks.json"), "utf-8"),
    ) as {
      hooks: {
        beforeReadFile?: ReadonlyArray<{ command: string }>;
        afterFileEdit?: ReadonlyArray<{ command: string }>;
      };
    };
    expect(after.hooks.afterFileEdit?.[0]?.command).toBe("./lint.sh");
    expect(after.hooks.beforeReadFile?.[0]?.command).toBe(
      ".cursor/hooks/env-read.sh",
    );
  });

  it("flags workflow context registered on an event that discards output", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-workflow-event-"));
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# Demo\n- Use tests\n");
    await writeFile(
      join(root, ".cursor", "hooks.json"),
      JSON.stringify({
        version: 1,
        hooks: {
          afterFileEdit: [{ command: ".cursor/hooks/workflow-check.sh" }],
        },
      }),
    );
    const result = await runCursorAnalyzers(
      await parseCursorConfig(root),
      root,
    );
    expect(findIssue(result, "Hooks", "missing workflow check")).toBeDefined();
  });

  it("refreshes a stale marked Launchpad hook script", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-stale-"));
    await scaffoldCursor(
      root,
      { name: "demo", description: "" },
      fixedDetectedProject,
    );
    const script = join(root, ".cursor", "hooks", "env-read.sh");
    await writeFile(
      script,
      "#!/bin/bash\n# lp-cursor-hook-version: 0\nexit 0\n",
    );
    const result = await runCursorAnalyzers(
      await parseCursorConfig(root),
      root,
    );
    expect(
      findIssue(result, "Hooks", "stale Launchpad hook script"),
    ).toBeDefined();
    await applyCursorFixes(
      result.flatMap((entry) => entry.issues),
      root,
    );
    expect(await readFile(script, "utf-8")).toContain(
      "lp-cursor-hook-version: 2",
    );
  });

  it("flags malformed sandbox.json as a Security diagnostic", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-sandbox-"));
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# Demo\n- Use tests\n");
    await writeFile(join(root, ".cursor", "sandbox.json"), "{ invalid\n");
    const result = await runCursorAnalyzers(
      await parseCursorConfig(root),
      root,
    );
    expect(
      findIssue(result, "Security", "Malformed .cursor/sandbox.json")?.severity,
    ).toBe("high");
  });

  it("does not clobber malformed hooks.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-malformed-"));
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, ".cursor", "hooks.json"), "{ invalid\n");
    await writeFile(join(root, "AGENTS.md"), "# Demo\n");
    const results = await runCursorAnalyzers(
      await parseCursorConfig(root),
      root,
    );
    await applyCursorReportFixes(results, root, false);
    expect(await readFile(join(root, ".cursor", "hooks.json"), "utf-8")).toBe(
      "{ invalid\n",
    );
  });
});
