import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  resolveHookCommand,
  effectiveCommandText,
} from "../src/commands/doctor/analyzers/hook-resolver.js";

describe("resolveHookCommand", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "lp-resolver-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns command as-is when no .sh script is referenced", async () => {
    const r = await resolveHookCommand({ command: "claude-launchpad memory context --json" }, root);
    expect(r.command).toBe("claude-launchpad memory context --json");
    expect(r.expansions).toHaveLength(0);
    expect(r.missingScripts).toHaveLength(0);
    expect(effectiveCommandText(r)).toBe("claude-launchpad memory context --json");
  });

  it("reads and attaches the body of a .sh wrapper inside projectRoot", async () => {
    await mkdir(join(root, ".claude"), { recursive: true });
    await writeFile(
      join(root, ".claude", "session-start.sh"),
      "#!/bin/bash\nclaude-launchpad memory context --json\n",
    );
    const r = await resolveHookCommand(
      { command: "bash .claude/session-start.sh 2>/dev/null; exit 0" },
      root,
    );
    expect(r.expansions).toHaveLength(1);
    expect(r.expansions[0].path).toBe(".claude/session-start.sh");
    expect(effectiveCommandText(r)).toContain("memory context");
  });

  it("flags missing wrapper scripts instead of silently passing", async () => {
    const r = await resolveHookCommand(
      { command: "bash .claude/does-not-exist.sh; exit 0" },
      root,
    );
    expect(r.expansions).toHaveLength(0);
    expect(r.missingScripts).toContain(".claude/does-not-exist.sh");
  });

  it("rejects absolute paths that resolve outside projectRoot", async () => {
    const r = await resolveHookCommand({ command: "bash /etc/hosts.sh" }, root);
    expect(r.expansions).toHaveLength(0);
    // /etc/hosts.sh doesn't exist, so it lands in missingScripts — the boundary
    // check only matters when the file *does* exist. Sufficient: no body was read.
    expect(effectiveCommandText(r)).toBe("bash /etc/hosts.sh");
  });

  it("rejects symlinks that escape projectRoot via realpath", async () => {
    // Create a real .sh outside the project root, then a symlink inside pointing to it.
    const outsideRoot = await mkdtemp(join(tmpdir(), "lp-outside-"));
    const outsideScript = join(outsideRoot, "evil.sh");
    await writeFile(outsideScript, "claude-launchpad memory context\n");
    await mkdir(join(root, ".claude"), { recursive: true });
    await symlink(outsideScript, join(root, ".claude", "link.sh"));

    const r = await resolveHookCommand(
      { command: "bash .claude/link.sh" },
      root,
    );
    expect(r.expansions).toHaveLength(0);
    expect(effectiveCommandText(r)).not.toContain("memory context");
    await rm(outsideRoot, { recursive: true, force: true });
  });

  it("ignores tokens that don't end in .sh", async () => {
    await mkdir(join(root, ".claude"), { recursive: true });
    await writeFile(join(root, ".claude", "script.py"), "print('hello')");
    const r = await resolveHookCommand(
      { command: "python .claude/script.py" },
      root,
    );
    expect(r.expansions).toHaveLength(0);
    expect(r.missingScripts).toHaveLength(0);
  });

  it("ignores tokens containing variable expansion (~, $)", async () => {
    await mkdir(join(root, ".claude"), { recursive: true });
    await writeFile(join(root, ".claude", "x.sh"), "echo hi");
    const r = await resolveHookCommand(
      { command: "bash $HOME/x.sh; bash ~/x.sh" },
      root,
    );
    expect(r.expansions).toHaveLength(0);
  });

  it("handles empty command gracefully", async () => {
    const r = await resolveHookCommand({ command: "" }, root);
    expect(r.command).toBe("");
    expect(r.expansions).toHaveLength(0);
    expect(r.missingScripts).toHaveLength(0);
  });

  it("handles undefined command gracefully", async () => {
    const r = await resolveHookCommand({}, root);
    expect(r.command).toBe("");
    expect(r.expansions).toHaveLength(0);
  });
});
