#!/usr/bin/env bash
# Warns on BACKLOG.md / TASKS.md drift. Non-blocking (always exits 0).
# Warnings are emitted as PostToolUse additionalContext JSON so they reach
# the model — bare stdout on PostToolUse only reaches the transcript view.
#   1. A WP entry lives in a BACKLOG.md P-section AND in '## Current Sprint'
#      (violates move-not-copy). Changelog + "Depends on:" mentions are fine.
#   2. TASKS.md longer than 80 lines.
#   3. '## Current Sprint' has more than 15 items (hard split trigger).
#   4. '## Session Log' has more than 3 entries.
#   5. A pulled WP's "Depends on:" dependency still sits in a P-section.

set -u
command -v jq >/dev/null 2>&1 || exit 0
fp=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Only act on edits to BACKLOG.md or TASKS.md.
echo "$fp" | grep -qE '(^|/)(BACKLOG|TASKS)\.md$' || exit 0

warnings=""
warn() { warnings="${warnings}$*
"; }

# WP IDs that live as entries in BACKLOG P-sections (not Changelog, not Depends-on).
backlog_ids=""
if [ -f BACKLOG.md ]; then
  backlog_ids=$(awk '/^## P[0-3]/{f=1;next} /^## Changelog/{f=0} f' BACKLOG.md 2>/dev/null | grep -v 'Depends on:' | grep -oE 'WP-[0-9]{3,}' | sort -u || true)
fi

# WP IDs in the Current Sprint checklist.
sprint_ids=""
if [ -f TASKS.md ]; then
  sprint_ids=$(awk '/^## Current/{f=1;next} /^## /{f=0} f' TASKS.md 2>/dev/null | grep -oE 'WP-[0-9]{3,}' | sort -u || true)
fi

# 1. Same WP as a live entry in both files.
if [ -n "$backlog_ids" ] && [ -n "$sprint_ids" ]; then
  dupes=$(comm -12 <(printf '%s\n' "$backlog_ids") <(printf '%s\n' "$sprint_ids"))
  if [ -n "$dupes" ]; then
    warn "Workflow bug: WP present in BOTH a BACKLOG.md P-section and '## Current Sprint' (violates move-not-copy — see .claude/rules/workflow.md): $(printf '%s ' $dupes)— move each listed WP to exactly one file."
  fi
fi

if [ -f TASKS.md ]; then
  # 2. TASKS.md length.
  tasks_lines=$(wc -l < TASKS.md 2>/dev/null | tr -d ' ')
  if [ "${tasks_lines:-0}" -gt 80 ]; then
    warn "TASKS.md is $tasks_lines lines — should stay under 80. Prune Completed Sprints or Session Log."
  fi

  # 3. Current Sprint size (hard trigger; the soft target is 3-6).
  current_count=$(awk '/^## Current/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^[[:space:]]*- \[[ xX]\]' || true)
  if [ "${current_count:-0}" -gt 15 ]; then
    warn "'## Current Sprint' has $current_count items — split the sprint (see .claude/rules/workflow.md)."
  fi

  # 4. Session Log size.
  log_count=$(awk '/^## Session Log/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^- \*\*' || true)
  if [ "${log_count:-0}" -gt 3 ]; then
    warn "'## Session Log' has $log_count entries — keep to 3 max."
  fi
fi

# 5. Dependency-aware pulls: the pulled WP's 7-field body left BACKLOG.md, but
# HEAD's copy (pre-pull) still records its "Depends on:" line.
if [ -n "$sprint_ids" ] && git rev-parse --verify HEAD >/dev/null 2>&1; then
  for wp in $sprint_ids; do
    deps=$( { git show HEAD:BACKLOG.md 2>/dev/null; cat BACKLOG.md 2>/dev/null; } | awk -v id="$wp" '$0 ~ "^### "id" "{f=1;next} /^### /{f=0} f && /Depends on:/{print}' | grep -oE 'WP-[0-9]{3,}' | sort -u || true)
    for dep in $deps; do
      if printf '%s\n' "$backlog_ids" | grep -qx "$dep"; then
        warn "$wp was pulled into the sprint but its dependency $dep is still in BACKLOG.md — pull $dep too, or move $wp back until $dep ships."
      fi
    done
  done
fi

if [ -n "$warnings" ]; then
  jq -n --arg ctx "$warnings" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'
fi
exit 0
