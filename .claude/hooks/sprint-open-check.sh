#!/usr/bin/env bash
# Warns when TASKS.md opens a new sprint block but BACKLOG.md has no staged
# deletions, i.e. the "remove pulled WPs from BACKLOG in the same edit" rule
# from CLAUDE.md was skipped. Non-blocking (always exits 0).

set -u
cmd="${TOOL_INPUT_COMMAND:-}"

# Only act on `git commit`, word-boundary match.
echo "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])git[[:space:]]+commit([[:space:]]|$)' || exit 0

# Nothing staged
git diff --cached --quiet 2>/dev/null && exit 0

# TASKS.md not staged
git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -q '^TASKS\.md$' || exit 0

# Does the staged TASKS.md diff ADD a new `## Current` block?
new_sprint=$(git diff --cached TASKS.md 2>/dev/null | grep -cE '^\+## Current')
[ "$new_sprint" -eq 0 ] && exit 0

# If a new sprint was opened, BACKLOG.md should have net deletions.
backlog_deletions=$(git diff --cached BACKLOG.md 2>/dev/null | grep -cE '^-[^-]')
if [ "$backlog_deletions" -eq 0 ]; then
  echo ""
  echo "WARNING: sprint-open hygiene"
  echo ""
  echo "TASKS.md stages a new '## Current' block, but BACKLOG.md has no"
  echo "staged deletions. When a WP is pulled from BACKLOG.md into a sprint,"
  echo "remove it from BACKLOG.md in the same edit. Overlap = drift."
  echo ""
  echo "If you opened a fresh-scope sprint with no BACKLOG pulls, ignore"
  echo "this. Otherwise scrub BACKLOG.md before committing."
  echo ""
fi

exit 0
