import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type { DiagnosticIssue } from "../src/types/index.js";
import { applyCursorFixes } from "../src/harness/cursor/fixer.js";

async function createCursorFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lp-cursor-fixer-"));
  await mkdir(join(root, ".cursor"), { recursive: true });
  await writeFile(join(root, "AGENTS.md"), "# Demo\n");
  return root;
}

async function writeFixture(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function readFixture(
  root: string,
  relativePath: string,
): Promise<string> {
  return readFile(join(root, relativePath), "utf-8");
}

function cursorIssue(analyzer: string, message: string): DiagnosticIssue {
  return { analyzer, message, severity: "medium", fix: "Run doctor --fix" };
}

describe("Cursor file fixers", () => {
  it("creates a missing verification rule and is idempotent", async () => {
    const root = await createCursorFixture();
    const issue = cursorIssue("Rules", "No .cursor/rules/verification.mdc");
    expect(await applyCursorFixes([issue], root)).toEqual({
      fixed: 1,
      skipped: 0,
    });
    expect(await applyCursorFixes([issue], root)).toEqual({
      fixed: 0,
      skipped: 1,
    });
  });

  it("updates an outdated marked rule", async () => {
    const root = await createCursorFixture();
    await writeFixture(
      root,
      ".cursor/rules/verification.mdc",
      [
        "---",
        "description: Old",
        "alwaysApply: true",
        "---",
        "<!-- lp-cursor-verification-version: 0 -->",
      ].join("\n"),
    );
    const issue = cursorIssue("Rules", "verification.mdc rule is outdated");
    expect((await applyCursorFixes([issue], root)).fixed).toBe(1);
    expect(await readFixture(root, ".cursor/rules/verification.mdc")).toContain(
      "lp-cursor-verification-version: 1",
    );
  });

  it("does not overwrite an unmarked user rule", async () => {
    const root = await createCursorFixture();
    await writeFixture(root, ".cursor/rules/verification.mdc", "# My policy\n");
    const issue = cursorIssue("Rules", "verification.mdc rule is outdated");
    expect(await applyCursorFixes([issue], root)).toEqual({
      fixed: 0,
      skipped: 1,
    });
    expect(await readFixture(root, ".cursor/rules/verification.mdc")).toBe(
      "# My policy\n",
    );
  });

  it("adds .env to .cursorignore without dropping user patterns", async () => {
    const root = await createCursorFixture();
    await writeFixture(root, ".cursorignore", "node_modules/\n");
    const issue = cursorIssue("Security", ".env is missing from .cursorignore");
    expect((await applyCursorFixes([issue], root)).fixed).toBe(1);
    expect(await readFixture(root, ".cursorignore")).toContain("node_modules/");
    expect(await readFixture(root, ".cursorignore")).toMatch(/^\.env$/m);
  });
});
