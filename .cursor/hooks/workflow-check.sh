#!/usr/bin/env bash
# lp-cursor-hook-version: 2
set -u

command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }
input=$(cat 2>/dev/null)
fp=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
echo "$fp" | grep -qE '(^|/)(BACKLOG|TASKS)\.md$' || { echo '{}'; exit 0; }

warnings=""
warn() { warnings="${warnings}$*
"; }

backlog_ids=""
if [ -f BACKLOG.md ]; then
  backlog_ids=$(awk '/^## P[0-3]/{f=1;next} /^## /{f=0} f' BACKLOG.md 2>/dev/null | grep -E '^### ' | grep -oE 'WP-[0-9]{3,}' | sort -u || true)
fi

sprint_ids=""
if [ -f TASKS.md ]; then
  sprint_ids=$(awk '/^## Current/{f=1;next} /^## /{f=0} f' TASKS.md 2>/dev/null | grep -oE 'WP-[0-9]{3,}' | sort -u || true)
fi

if [ -n "$backlog_ids" ] && [ -n "$sprint_ids" ]; then
  dupes=$(comm -12 <(printf '%s\n' "$backlog_ids") <(printf '%s\n' "$sprint_ids"))
  if [ -n "$dupes" ]; then
    warn "Workflow bug: WP present in BOTH a BACKLOG.md P-section and '## Current Sprint' (violates move-not-copy — see .cursor/rules/workflow.mdc): $(printf '%s ' $dupes)— move each listed WP to exactly one file."
  fi
fi

if [ -f TASKS.md ]; then
  tasks_lines=$(wc -l < TASKS.md 2>/dev/null | tr -d ' ')
  if [ "${tasks_lines:-0}" -gt 80 ]; then
    warn "TASKS.md is $tasks_lines lines — should stay under 80. Prune Completed Sprints or Session Log."
  fi

  current_count=$(awk '/^## Current/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^[[:space:]]*- \[[ xX]\]' || true)
  if [ "${current_count:-0}" -gt 15 ]; then
    warn "'## Current Sprint' has $current_count items — split the sprint (see .cursor/rules/workflow.mdc)."
  fi

  log_count=$(awk '/^## Session Log/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^- \*\*' || true)
  if [ "${log_count:-0}" -gt 3 ]; then
    warn "'## Session Log' has $log_count entries — keep to 3 max."
  fi
fi

if [ -n "$warnings" ]; then
  jq -n --arg ctx "$warnings" '{additional_context:$ctx}'
else
  echo '{}'
fi
exit 0
