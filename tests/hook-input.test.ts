import { describe, it, expect } from "vitest";
import {
  jqField,
  READ_STDIN_PREAMBLE,
  hasEnvVarHookPattern,
} from "../src/lib/hook-input.js";

describe("hook-input utilities", () => {
  it("jqField('file_path') reads from stdin via jq with empty fallback", () => {
    expect(jqField("file_path")).toBe(`$(jq -r '.tool_input.file_path // empty' 2>/dev/null)`);
  });

  it("jqField('command') reads command field", () => {
    expect(jqField("command")).toBe(`$(jq -r '.tool_input.command // empty' 2>/dev/null)`);
  });

  it("READ_STDIN_PREAMBLE captures stdin once for multi-field reads", () => {
    expect(READ_STDIN_PREAMBLE).toBe(`input=$(cat 2>/dev/null)`);
  });

  it("jqField('file_path', 'input') reads from a captured shell variable", () => {
    expect(jqField("file_path", "input")).toBe(
      `$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)`,
    );
  });

  describe("hasEnvVarHookPattern", () => {
    it("matches $TOOL_INPUT_FILE_PATH", () => {
      expect(hasEnvVarHookPattern(`echo "$TOOL_INPUT_FILE_PATH" | grep TASKS`)).toBe(true);
    });

    it("matches ${TOOL_INPUT_COMMAND:-}", () => {
      expect(hasEnvVarHookPattern(`cmd="\${TOOL_INPUT_COMMAND:-}"`)).toBe(true);
    });

    it("matches ${TOOL_INPUT_FILE_PATH##*.}", () => {
      expect(hasEnvVarHookPattern(`ext=\${TOOL_INPUT_FILE_PATH##*.}`)).toBe(true);
    });

    it("matches $TOOL_INPUT_NEW_TEXT", () => {
      expect(hasEnvVarHookPattern(`content="$TOOL_INPUT_NEW_TEXT"`)).toBe(true);
    });

    it("does NOT match strings that mention tool_input in a docstring/jq path", () => {
      expect(hasEnvVarHookPattern(`# uses tool_input.file_path from stdin`)).toBe(false);
    });

    it("does NOT match jq-based reads", () => {
      expect(hasEnvVarHookPattern(`$(jq -r '.tool_input.file_path' 2>/dev/null)`)).toBe(false);
    });

    it("does NOT match TOOL_INPUT followed by a non-field word", () => {
      expect(hasEnvVarHookPattern(`# TOOL_INPUT_DOES_NOT_EXIST_AS_AN_ENV_VAR`)).toBe(false);
    });
  });
});
