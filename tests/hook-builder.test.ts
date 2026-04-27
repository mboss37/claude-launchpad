import { describe, it, expect } from "vitest";
import { addOrUpdateHook } from "../src/lib/hook-builder.js";

describe("addOrUpdateHook", () => {
  const sampleEntry = {
    matcher: "startup",
    hooks: [{ type: "command" as const, command: "echo hello" }],
  };

  it("adds a hook to undefined existing hooks", () => {
    const result = addOrUpdateHook(undefined, {
      event: "SessionStart",
      dedupKeyword: "echo hello",
      entry: sampleEntry,
    });
    expect(result.added).toBe(true);
    expect(result.hooks.SessionStart).toHaveLength(1);
  });

  it("adds a hook to empty hooks record", () => {
    const result = addOrUpdateHook({}, {
      event: "SessionStart",
      dedupKeyword: "echo hello",
      entry: sampleEntry,
    });
    expect(result.added).toBe(true);
    expect(result.hooks.SessionStart).toHaveLength(1);
  });

  it("appends to existing event by default", () => {
    const existing = {
      SessionStart: [{ matcher: "resume", hooks: [{ type: "command", command: "cat TASKS.md" }] }],
    };
    const result = addOrUpdateHook(existing, {
      event: "SessionStart",
      dedupKeyword: "echo hello",
      entry: sampleEntry,
    });
    expect(result.added).toBe(true);
    expect(result.hooks.SessionStart).toHaveLength(2);
    expect((result.hooks.SessionStart[1] as Record<string, unknown>).matcher).toBe("startup");
  });

  it("prepends when prepend=true", () => {
    const existing = {
      SessionStart: [{ matcher: "resume", hooks: [{ type: "command", command: "cat TASKS.md" }] }],
    };
    const result = addOrUpdateHook(existing, {
      event: "SessionStart",
      dedupKeyword: "echo hello",
      entry: sampleEntry,
      prepend: true,
    });
    expect(result.added).toBe(true);
    expect(result.hooks.SessionStart).toHaveLength(2);
    expect((result.hooks.SessionStart[0] as Record<string, unknown>).matcher).toBe("startup");
  });

  it("dedups by command substring — does not add when keyword matches", () => {
    const existing = {
      SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "memory pull -y" }] }],
    };
    const result = addOrUpdateHook(existing, {
      event: "SessionStart",
      dedupKeyword: "memory pull",
      entry: sampleEntry,
    });
    expect(result.added).toBe(false);
    expect(result.hooks.SessionStart).toHaveLength(1);
    expect(result.hooks).toBe(existing as Record<string, unknown[]>);
  });

  it("does not collide across different events", () => {
    const existing = {
      SessionEnd: [{ hooks: [{ type: "command", command: "memory push" }] }],
    };
    const result = addOrUpdateHook(existing, {
      event: "SessionStart",
      dedupKeyword: "memory push",
      entry: sampleEntry,
    });
    expect(result.added).toBe(true);
    expect(result.hooks.SessionStart).toHaveLength(1);
    expect(result.hooks.SessionEnd).toHaveLength(1);
  });

  it("does not mutate input hooks record", () => {
    const existing = {
      SessionStart: [{ matcher: "resume", hooks: [{ type: "command", command: "cat TASKS.md" }] }],
    };
    const snapshot = JSON.parse(JSON.stringify(existing));
    addOrUpdateHook(existing, {
      event: "SessionStart",
      dedupKeyword: "echo hello",
      entry: sampleEntry,
    });
    expect(existing).toEqual(snapshot);
  });
});
