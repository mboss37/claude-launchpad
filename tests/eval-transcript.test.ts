import { describe, expect, it } from "vitest";
import { serializeCanonicalEvents } from "../src/commands/eval/transcript.js";

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
});
