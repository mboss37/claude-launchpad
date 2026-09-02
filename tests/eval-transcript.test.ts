import { describe, expect, it } from "vitest";
import {
  normalizeCursorRaw,
  serializeCanonicalEvents,
} from "../src/commands/eval/transcript.js";

describe("canonical eval transcript", () => {
  it("serializes only stable fields", () => {
    expect(
      serializeCanonicalEvents([
        { kind: "shell", command: "pnpm test" },
        { kind: "blocked", reason: "Destructive command detected" },
        { kind: "text", role: "assistant", content: "I stopped." },
      ]),
    ).toBe(
      [
        "shell: pnpm test",
        "blocked: Destructive command detected",
        "assistant: I stopped.",
      ].join("\n"),
    );
  });

  it("normalizes documented Cursor CLI tool-call envelopes", () => {
    const raw = [
      JSON.stringify({
        type: "tool_call",
        subtype: "started",
        tool_call: { readToolCall: { args: { path: ".env" } } },
      }),
      JSON.stringify({
        type: "tool_call",
        subtype: "started",
        tool_call: { writeToolCall: { args: { path: "SUMMARY.md" } } },
      }),
      JSON.stringify({
        type: "tool_call",
        subtype: "started",
        tool_call: { shellToolCall: { args: { command: "node test.js" } } },
      }),
      JSON.stringify({
        type: "tool_call",
        subtype: "started",
        tool_call: {
          shellToolCall: {
            args: { command: "node /tmp/lp-eval/test.js" },
          },
        },
      }),
    ].join("\n");

    expect(normalizeCursorRaw(raw)).toEqual([
      { kind: "tool", name: "read", summary: "path=.env" },
      { kind: "tool", name: "write", summary: "path=SUMMARY.md" },
      { kind: "shell", command: "node test.js" },
      { kind: "shell", command: "node /tmp/lp-eval/test.js" },
    ]);
  });

  it("does not turn assistant prose into blocked or shell evidence", () => {
    const raw = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "BLOCKED was mentioned, but I did not run node test.js.",
          },
        ],
      },
    });

    expect(normalizeCursorRaw(raw)).toEqual([
      {
        kind: "text",
        role: "assistant",
        content: "BLOCKED was mentioned, but I did not run node test.js.",
      },
    ]);
  });

  it("normalizes a structured Cursor permission denial as blocked", () => {
    const raw = JSON.stringify({
      type: "tool_call",
      subtype: "completed",
      tool_call: {
        readToolCall: {
          result: { error: { errorMessage: "Permission denied" } },
        },
      },
    });

    expect(normalizeCursorRaw(raw)).toContainEqual({
      kind: "blocked",
      reason: "BLOCKED: Permission denied",
    });
  });

  it("does not treat successful tool output as blocked evidence", () => {
    const raw = JSON.stringify({
      type: "tool_call",
      subtype: "completed",
      tool_call: {
        shellToolCall: {
          result: {
            success: { stdout: "BLOCKED and Permission denied are test text" },
          },
        },
      },
    });

    expect(
      normalizeCursorRaw(raw).some((event) => event.kind === "blocked"),
    ).toBe(false);
  });
});
