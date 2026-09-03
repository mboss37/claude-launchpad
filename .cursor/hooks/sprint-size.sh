#!/usr/bin/env bash
# lp-cursor-hook-version: 2
set -u

[ -f TASKS.md ] || { echo '{}'; exit 0; }
command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }
section=$(sed -n '/^## Current/,/^## /p' TASKS.md 2>/dev/null)
[ -z "$section" ] && { echo '{}'; exit 0; }
unchecked=$(echo "$section" | grep -cE '^[[:space:]]*- \[ \]' || true)
checked=$(echo "$section" | grep -cE '^[[:space:]]*- \[[xX]\]' || true)
total=$((unchecked + checked))
emit() { jq -n --arg ctx "$1" '{additional_context:$ctx}'; exit 0; }
if [ "$total" -eq 0 ]; then
  emit "NOTE: Current sprint has no work packages yet. Pull 3-6 from BACKLOG.md to start."
fi
[ "$unchecked" -eq 0 ] && { echo '{}'; exit 0; }
if [ "$unchecked" -lt 3 ]; then
  emit "NOTE: Current sprint has $unchecked open work package(s) — that's a microsprint. Pull from BACKLOG.md (aim 3-6)."
fi
if [ "$unchecked" -gt 7 ]; then
  emit "NOTE: Current sprint has $unchecked open work packages — oversized (soft target 3-6; above 15, workflow-check requires a split)."
fi
echo '{}'
exit 0
