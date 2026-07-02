#!/usr/bin/env bash
# After a git commit, warns when the commit adds WP checkboxes to
# '## Current Sprint' without deleting anything from BACKLOG.md — i.e. the
# "pull = move, not copy" rule was skipped. Runs on PostToolUse (Bash):
# PreToolUse has no non-blocking way to reach the model, so instead of
# blocking the commit we suggest an amend. Warning is emitted as
# additionalContext JSON — bare stdout on PostToolUse never reaches the model.
# Non-blocking (always exits 0).

set -u
command -v jq >/dev/null 2>&1 || exit 0
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null)

# Only act on \`git commit\`, word-boundary match.
echo "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])git[[:space:]]+commit([[:space:]]|$)' || exit 0

git rev-parse --verify HEAD >/dev/null 2>&1 || exit 0

# The commit must touch TASKS.md and add unchecked WP lines to it.
git show --name-only --format= HEAD 2>/dev/null | grep -qx 'TASKS.md' || exit 0
pulled=$(git show --format= HEAD -- TASKS.md 2>/dev/null | grep -cE '^\+[[:space:]]*- \[ \] WP-' || true)
[ "${pulled:-0}" -eq 0 ] && exit 0

# A pull commit should also delete the WP bodies from BACKLOG.md.
backlog_deletions=$(git show --format= HEAD -- BACKLOG.md 2>/dev/null | grep -cE '^-[^-]' || true)
if [ "${backlog_deletions:-0}" -eq 0 ]; then
  jq -n --arg ctx "Sprint-open hygiene: the commit you just made adds WP checkbox(es) to '## Current Sprint' but deletes nothing from BACKLOG.md. Pulling a WP means MOVING it — delete its entry from BACKLOG.md in the same commit. If these WPs came from BACKLOG.md, scrub it now and run 'git commit --amend'. If this is a fresh-scope sprint with no backlog pulls, ignore this." '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'
fi

exit 0
