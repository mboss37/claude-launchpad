/**
 * Canonical helpers for hook command strings.
 *
 * Claude Code passes hook context as JSON on stdin, NOT as env vars.
 * Reading $TOOL_INPUT_FILE_PATH or $TOOL_INPUT_COMMAND from a hook command
 * sees an empty string and the hook silently no-ops on the first guard line.
 *
 * Use jqField("file_path") for single-field reads.
 * Use READ_STDIN_PREAMBLE + jqField("...", "input") when a hook needs
 * multiple fields from the same JSON input (stdin can only be read once).
 *
 * Reference: https://code.claude.com/docs/en/hooks.md
 *   "For command hooks, input arrives on stdin."
 *   "command=$(jq -r '.tool_input.command' < /dev/stdin)"
 */

export type ToolInputField = "file_path" | "command" | "new_text" | "content";

export function jqField(field: ToolInputField, fromVar?: string): string {
  if (fromVar) {
    return `$(echo "$${fromVar}" | jq -r '.tool_input.${field} // empty' 2>/dev/null)`;
  }
  return `$(jq -r '.tool_input.${field} // empty' 2>/dev/null)`;
}

export const READ_STDIN_PREAMBLE = `input=$(cat 2>/dev/null)`;

const ENV_VAR_PATTERN = /\$\{?TOOL_INPUT_(FILE_PATH|COMMAND|NEW_TEXT|CONTENT)/;

export function hasEnvVarHookPattern(commandString: string): boolean {
  return ENV_VAR_PATTERN.test(commandString);
}
