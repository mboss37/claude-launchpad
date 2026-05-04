#!/usr/bin/env bash
# Warns on BACKLOG.md / TASKS.md drift. Non-blocking (always exits 0).
#   1. Same WP ID present in BOTH BACKLOG.md and TASKS.md (violates move-not-copy).
#   2. TASKS.md longer than 80 lines.
#   3. \`## Current Sprint\` contains more than 15 items.
#   4. \`## Session Log\` has more than 3 entries.

set -u
fp="${TOOL_INPUT_FILE_PATH:-}"

# Only act on edits to BACKLOG.md or TASKS.md.
echo "$fp" | grep -qE '(^|/)(BACKLOG|TASKS)\.md$' || exit 0

warn() { printf '%s\n' "$*"; }

# 1. Duplicate WP IDs across both files.
if [ -f BACKLOG.md ] && [ -f TASKS.md ]; then
  dupes=$(grep -oE 'WP-[0-9]{3}' BACKLOG.md 2>/dev/null | sort -u | while read -r wp; do
    grep -q "$wp" TASKS.md 2>/dev/null && echo "$wp"
  done)
  if [ -n "$dupes" ]; then
    warn "Workflow bug: WP ID present in BOTH BACKLOG.md and TASKS.md (violates move-not-copy — see .claude/rules/workflow.md):"
    printf '%s\n' "$dupes"
    warn "Move each listed WP to exactly one file."
  fi
fi

# 2. TASKS.md length.
if [ -f TASKS.md ]; then
  tasks_lines=$(wc -l < TASKS.md 2>/dev/null | tr -d ' ')
  if [ "${tasks_lines:-0}" -gt 80 ]; then
    warn "TASKS.md is $tasks_lines lines — should stay under 80. Prune Completed Sprints or Session Log."
  fi

  # 3. Current Sprint size.
  current_count=$(awk '/^## Current/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^[[:space:]]*- \[[ x]\]' || true)
  if [ "${current_count:-0}" -gt 15 ]; then
    warn "## Current Sprint has $current_count items — split the sprint (see .claude/rules/workflow.md)."
  fi

  # 4. Session Log size.
  log_count=$(awk '/^## Session Log/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^- \*\*' || true)
  if [ "${log_count:-0}" -gt 3 ]; then
    warn "## Session Log has $log_count entries — keep to 3 max."
  fi
fi

exit 0
