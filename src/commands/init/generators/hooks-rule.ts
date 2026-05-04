export const HOOKS_RULE_VERSION = 1;

export function generateHooksRule(): string {
  return `---
paths: [".claude/settings.json", ".claude/settings.local.json"]
---

# Claude Code Hook Authoring Rules

<!-- lp-hooks-version: ${HOOKS_RULE_VERSION} -->

Applies to every hook entry in \`.claude/settings.json\` and \`.claude/settings.local.json\`. Hooks are the project's automated safety net. Getting the API wrong silently disables the protection without any error. **A broken hook is worse than no hook because it gives false confidence.**

Reference: https://code.claude.com/docs/en/hooks

## Anatomy of a hook entry

\`\`\`json
{
  "hooks": {
    "<EventName>": [
      {
        "matcher": "<ToolMatcher>",
        "hooks": [
          { "type": "command", "command": "<shell-string>" }
        ]
      }
    ]
  }
}
\`\`\`

- \`EventName\`: \`SessionStart\`, \`SessionEnd\`, \`PreToolUse\`, \`PostToolUse\`, \`PostCompact\`, \`PreCompact\`, \`UserPromptSubmit\`, \`Stop\`, etc.
- \`matcher\`: a regex-style string matching tool names (e.g. \`Bash\`, \`Read|Write|Edit\`). Empty string matches all tools for the event. For SessionStart use \`startup\`, \`resume\`, \`clear\`, or \`compact\`.
- \`hooks\` array: every entry runs in parallel when the matcher fires. Identical command strings are deduplicated automatically.

## Input — JSON on stdin, NOT env vars

The hook receives a JSON payload on stdin. **There are no \`TOOL_INPUT_*\` environment variables in current Claude Code.** A hook that does \`cmd="$TOOL_INPUT_COMMAND"\` reads an empty string and silently no-ops. This is the single most common authoring bug.

Canonical extraction:

\`\`\`bash
fp=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)   # PreToolUse Read|Write|Edit
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null)    # PreToolUse Bash
new=$(jq -r '.tool_input.new_string // .tool_input.content // empty' 2>/dev/null)  # PostToolUse Edit|Write
\`\`\`

Top-level keys you can read: \`session_id\`, \`transcript_path\`, \`cwd\`, \`permission_mode\`, \`hook_event_name\`, \`tool_name\`, \`tool_input\`, \`tool_use_id\`. \`PostToolUse\` adds \`tool_response\`.

\`jq\` is a project-level requirement. Install via \`brew install jq\` (macOS) or your distro's package manager.

## Exit codes — 2 blocks, 1 does not

| Exit code | Effect |
|---|---|
| \`0\` | Allow the action. Hook stdout becomes context (SessionStart) or is informational (PostToolUse). |
| \`2\` | Block the action. Hook stderr is fed back to Claude as the error reason. |
| any other non-zero (\`1\`, \`127\`, …) | Treated as a non-blocking hook error. **The action proceeds anyway.** |

\`exit 1\` does NOT block. If the hook is meant to enforce a policy, it must end in \`exit 2\`.

Block reasons go to **stderr** (\`echo '...' >&2\`), not stdout. Stdout is ignored when exit code is 2 unless the hook returns the JSON envelope (see "Richer control" below).

## Output — stderr for blocks, stdout for warnings

\`\`\`bash
# Blocking: stderr + exit 2
echo 'BLOCKED: <reason shown to Claude>' >&2
exit 2

# Informational warning that does not block: stdout + exit 0
echo 'WARNING: <message printed to user>'
exit 0
\`\`\`

Richer control (only use when the simple form is insufficient):

\`\`\`bash
jq -n '{
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "<reason>"
  }
}'
exit 0
\`\`\`

## Multi-hook same matcher — combine into ONE entry

If two top-level entries share the same matcher (e.g. two \`PreToolUse\` entries both with \`matcher: "Bash"\`), behavior is undefined: in practice the second entry can fail to fire. **Always combine commands for the same matcher into a single entry's \`hooks\` array.**

Wrong:

\`\`\`jsonc
"PreToolUse": [
  { "matcher": "Bash", "hooks": [{ "type": "command", "command": "<destructive-guard>" }] },
  { "matcher": "Bash", "hooks": [{ "type": "command", "command": "<sprint-open-check>" }] }
]
\`\`\`

Right:

\`\`\`jsonc
"PreToolUse": [
  {
    "matcher": "Bash",
    "hooks": [
      { "type": "command", "command": "<destructive-guard>" },
      { "type": "command", "command": "<sprint-open-check>" }
    ]
  }
]
\`\`\`

## Hot-reload — there is none

Edits to \`.claude/settings.json\` or \`.claude/settings.local.json\` only take effect after a Claude Code session restart. Mid-session edits parse fine and persist to disk, but the running session keeps the hooks it loaded at start.

When fixing or adding a hook:

1. Edit settings.json
2. Test the hook command in isolation (see "Testing" below)
3. Restart Claude Code
4. Verify the hook fires by triggering the conditions it watches

Skipping step 3 means the new hook does not exist yet, no matter what the file says.

## Testing a hook command in isolation

Before installing or restarting, verify the command works by piping a fake JSON payload to it:

\`\`\`bash
HOOK=$(jq -r '.hooks.PreToolUse[<index>].hooks[<index>].command' .claude/settings.json)
echo '{"tool_input":{"command":"git push --force"}}' | bash -c "$HOOK"
echo "exit=$?"
\`\`\`

Expected for a correctly-blocking hook: stderr contains the BLOCKED reason, \`exit=2\`. If you see \`exit=0\` here, the hook will not block in production either.

For PostToolUse hooks that read file paths or content, build the JSON to mirror the tool you're matching:

\`\`\`bash
echo '{"tool_input":{"file_path":"docs/architecture.md","new_string":"..."}}' | bash -c "$HOOK"
\`\`\`

## Canonical templates

### PreToolUse Bash gate (block on regex match)

\`\`\`bash
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null); echo "$cmd" | grep -qE '<your-pattern>' || exit 0; echo 'BLOCKED: <reason>' >&2; exit 2
\`\`\`

**Do not anchor the pattern with \`^[[:space:]]*\`** when you want to catch chained commands. The hook receives the entire shell command string verbatim, so an anchored pattern silently misses commands like \`git status && git push\`. Use \`(^|[^[:alnum:]])<token>([[:space:]]|$)\` to match the token at start-of-line OR after a non-alphanumeric separator.

### PreToolUse Read|Write|Edit gate (block on file-path match)

\`\`\`bash
fp=$(jq -r '.tool_input.file_path // empty' 2>/dev/null); echo "$fp" | grep -qE '<your-pattern>' || exit 0; echo 'BLOCKED: <reason>' >&2; exit 2
\`\`\`

### PostToolUse informational warner (never blocks; just prints)

\`\`\`bash
fp=$(jq -r '.tool_input.file_path // empty' 2>/dev/null); echo "$fp" | grep -qE '<your-pattern>' || exit 0; echo '<warning text>'; exit 0
\`\`\`

PostToolUse blocking (exit 2) is supported but rare. By the time PostToolUse fires, the file write has already happened. Almost always you want exit 0 with a stdout message.

### SessionStart context injection

\`\`\`bash
cat <some-file> 2>/dev/null; exit 0
\`\`\`

Output goes into the session's context. Always exit 0; SessionStart blocking is not a thing.

## Adding a new hook — checklist

- [ ] Identify the event and matcher you actually need (\`PreToolUse\` for blocking before, \`PostToolUse\` for after-the-fact warnings).
- [ ] Read the input via stdin JSON with \`jq\`, **not env vars**.
- [ ] If it blocks: send reason to stderr, end with \`exit 2\`. If it warns: stdout, end with \`exit 0\`.
- [ ] If a hook for the same matcher already exists, add your command to its existing \`hooks\` array — do NOT create a second entry with the same matcher.
- [ ] Test the command in isolation by piping a fake JSON payload (see "Testing" above) — verify the exit code matches your intent.
- [ ] Restart Claude Code.
- [ ] Verify the hook fires under the conditions it watches and does not fire under benign conditions.

## Do not

- Don't reference \`$TOOL_INPUT_COMMAND\`, \`$TOOL_INPUT_FILE_PATH\`, \`$TOOL_INPUT_NEW_TEXT\`, or any other \`TOOL_INPUT_*\` env var. They do not exist; the hook silently no-ops.
- Don't \`exit 1\` to block. It is silently non-blocking. Use \`exit 2\`.
- Don't echo the block reason to stdout when exiting 2. Stdout is ignored in that case; only stderr reaches Claude.
- Don't create a second top-level entry with a matcher that already has an entry. Combine commands in the existing entry's \`hooks\` array.
- Don't expect mid-session settings.json edits to take effect. Restart is required.
- Don't ship a hook without isolation-testing the command first. A silent no-op is worse than no hook.
- Don't put long debug logging into a production hook. If you need diagnostics during development, write to \`/tmp/<name>.log\` and remove the line before commit.
`;
}
