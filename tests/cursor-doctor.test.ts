import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AnalyzerResult, DiagnosticIssue } from "../src/types/index.js";
import { parseCursorConfig } from "../src/harness/cursor/parser.js";
import { runCursorAnalyzers } from "../src/harness/cursor/doctor.js";
import { scaffoldCursor } from "../src/harness/cursor/scaffold.js";
import {
  CURSOR_FIX_UNAVAILABLE,
  guardCursorFix,
} from "../src/commands/doctor/index.js";
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

  it("rejects Cursor --fix", () => {
    expect(() => guardCursorFix(["cursor"], true)).toThrow(
      CURSOR_FIX_UNAVAILABLE,
    );
  });
});
