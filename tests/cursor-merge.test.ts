import { describe, expect, it } from "vitest";
import {
  mergeCursorHooks,
  mergeCursorMcp,
  replaceVersionedCursorFile,
} from "../src/harness/cursor/merge.js";

describe("Cursor config mergers", () => {
  it("preserves unrelated hooks and replaces a Launchpad hook by command path", () => {
    const existing = {
      version: 1,
      extra: "keep-me",
      hooks: {
        beforeShellExecution: [
          { command: "./custom-audit.sh" },
          {
            command: ".cursor/hooks/destructive-shell.sh",
            failClosed: false,
          },
        ],
      },
    };
    const generated = {
      version: 1,
      hooks: {
        beforeShellExecution: [
          {
            command: ".cursor/hooks/destructive-shell.sh",
            failClosed: true,
          },
        ],
      },
    };
    expect(mergeCursorHooks(existing, generated)).toEqual({
      version: 1,
      extra: "keep-me",
      hooks: {
        beforeShellExecution: [
          { command: "./custom-audit.sh" },
          {
            command: ".cursor/hooks/destructive-shell.sh",
            failClosed: true,
          },
        ],
      },
    });
  });

  it("merges MCP servers by name without deleting custom servers", () => {
    expect(
      mergeCursorMcp(
        { mcpServers: { custom: { url: "https://example.test/mcp" } } },
        {
          mcpServers: {
            "agentic-memory": {
              command: "npx",
              args: ["claude-launchpad", "memory", "serve"],
            },
          },
        },
      ),
    ).toMatchObject({
      mcpServers: { custom: {}, "agentic-memory": {} },
    });
  });

  it("rewrites marked files and refuses unmarked files", () => {
    const generated = "# Current\n<!-- lp-cursor-rule-version: 2 -->\n";
    expect(
      replaceVersionedCursorFile(
        "# Old\n<!-- lp-cursor-rule-version: 1 -->\n",
        generated,
        "lp-cursor-rule-version",
      ),
    ).toBe(generated);
    expect(
      replaceVersionedCursorFile(
        "# User-authored\n",
        generated,
        "lp-cursor-rule-version",
      ),
    ).toBeNull();
  });

  it("rejects a malformed hook array instead of coercing it", () => {
    expect(() =>
      mergeCursorHooks(
        {
          version: 1,
          hooks: { beforeReadFile: "not-an-array" },
        },
        {
          version: 1,
          hooks: {
            beforeReadFile: [{ command: ".cursor/hooks/env-read.sh" }],
          },
        },
      ),
    ).toThrow(/hook array/i);
  });
});
