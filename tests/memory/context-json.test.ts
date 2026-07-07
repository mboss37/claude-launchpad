import { describe, it, expect, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Real storage (temp DB) — proves the --json envelope end-to-end.
describe("context --json emits real hook JSON", () => {
  it("wraps the injection markdown in hookSpecificOutput.additionalContext", async () => {
    const dbDir = await mkdtemp(join(tmpdir(), "ctx-json-"));
    const writes: string[] = [];
    const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
    try {
      const { runContext } = await import("../../src/commands/memory/subcommands/context.js");
      await runContext({ json: true, dbPath: dbDir });
    } finally {
      spy.mockRestore();
    }
    const out = writes.join("");
    const parsed = JSON.parse(out) as {
      hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
    };
    expect(parsed.hookSpecificOutput?.hookEventName).toBe("SessionStart");
    expect(typeof parsed.hookSpecificOutput?.additionalContext).toBe("string");
  });
});
