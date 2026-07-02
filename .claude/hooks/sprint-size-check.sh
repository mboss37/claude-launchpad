#!/usr/bin/env bash
# Warns when the current sprint is too small (<3) or too large (>7 soft; 15 is
# the hard split trigger enforced by workflow-check). Sweet spot is 3-6 work
# packages. Runs on SessionStart, whose stdout is injected into context.
# Non-blocking (always exits 0).

set -u
tasks="${1:-TASKS.md}"
[ -f "$tasks" ] || exit 0

section=$(sed -n '/^## Current/,/^## /p' "$tasks" 2>/dev/null)
[ -z "$section" ] && exit 0

# Anchored so placeholder comments containing "- [ ]" don't count as WPs.
unchecked=$(echo "$section" | grep -cE '^[[:space:]]*- \[ \]' || true)
checked=$(echo "$section" | grep -cE '^[[:space:]]*- \[[xX]\]' || true)
total=$((unchecked + checked))

if [ "$total" -eq 0 ]; then
  echo "NOTE: Current sprint has no work packages yet. Pull 3-6 from BACKLOG.md to start."
  exit 0
fi

if [ "$unchecked" -eq 0 ]; then exit 0; fi

if [ "$unchecked" -lt 3 ]; then
  echo "NOTE: Current sprint has $unchecked open work package(s) — that's a microsprint. Pull from BACKLOG.md (aim 3-6)."
  exit 0
fi

if [ "$unchecked" -gt 7 ]; then
  echo "NOTE: Current sprint has $unchecked open work packages — oversized (soft target 3-6; above 15, workflow-check requires a split)."
  exit 0
fi

exit 0
