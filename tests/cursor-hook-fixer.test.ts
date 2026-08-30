import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fixedDetectedProject } from "./fixtures/detected-project.js";
import {
  createOrMergeCursorHooks,
  refreshCursorHookScripts,
} from "../src/harness/cursor/fixers/hooks.js";

const detected = fixedDetectedProject;

async function writeHooks(
  root: string,
  hooks: Record<string, unknown>,
): Promise<void> {
  await mkdir(join(root, ".cursor"), { recursive: true });
  await writeFile(
    join(root, ".cursor", "hooks.json"),
    JSON.stringify({ version: 1, hooks }, null, 2) + "\n",
  );
}

describe("Cursor hook fixers", () => {
  it("adds Launchpad hooks without deleting custom hooks", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-hooks-"));
    await writeHooks(root, {
      afterFileEdit: [{ command: "./custom-audit.sh" }],
    });
    expect(await createOrMergeCursorHooks(root, detected)).toBe(true);
    const parsed = JSON.parse(
      await readFile(join(root, ".cursor", "hooks.json"), "utf-8"),
    ) as { hooks: { afterFileEdit: ReadonlyArray<{ command: string }> } };
    expect(parsed.hooks.afterFileEdit[0]).toEqual({
      command: "./custom-audit.sh",
    });
  });

  it("sets failClosed on both security hooks", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-security-hooks-"));
    await writeHooks(root, {
      beforeReadFile: [
        {
          command: ".cursor/hooks/env-read.sh",
          failClosed: false,
        },
      ],
      beforeShellExecution: [
        {
          command: ".cursor/hooks/destructive-shell.sh",
          failClosed: false,
        },
      ],
    });
    expect(await createOrMergeCursorHooks(root, detected)).toBe(true);
    const parsed = JSON.parse(
      await readFile(join(root, ".cursor", "hooks.json"), "utf-8"),
    ) as {
      hooks: {
        beforeReadFile: Array<{ failClosed?: boolean }>;
        beforeShellExecution: Array<{ failClosed?: boolean }>;
      };
    };
    expect(parsed.hooks.beforeReadFile[0]?.failClosed).toBe(true);
    expect(parsed.hooks.beforeShellExecution[0]?.failClosed).toBe(true);
  });

  it("refreshes only Launchpad-owned scripts", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-scripts-"));
    const hooksDir = join(root, ".cursor", "hooks");
    await mkdir(hooksDir, { recursive: true });
    await writeFile(
      join(hooksDir, "env-read.sh"),
      "#!/bin/bash\n# lp-cursor-hook-version: 0\nexit 0\n",
    );
    await writeFile(join(hooksDir, "custom.sh"), "#!/bin/bash\necho custom\n");
    expect(await refreshCursorHookScripts(root, detected)).toBe(true);
    expect(await readFile(join(hooksDir, "env-read.sh"), "utf-8")).toContain(
      "lp-cursor-hook-version: 1",
    );
    expect(await readFile(join(hooksDir, "custom.sh"), "utf-8")).toBe(
      "#!/bin/bash\necho custom\n",
    );
  });

  it("makes generated scripts executable", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-modes-"));
    expect(await refreshCursorHookScripts(root, detected)).toBe(true);
    const info = await stat(join(root, ".cursor", "hooks", "env-read.sh"));
    expect(info.mode & 0o111).not.toBe(0);
  });
});
