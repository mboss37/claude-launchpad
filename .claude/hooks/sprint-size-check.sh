#!/usr/bin/env bash
# Warns when the current sprint is too small (<3) or too large (>7).
# Sweet spot is 3-6 work packages per sprint. Non-blocking (always exits 0).

set -u
tasks="${1:-TASKS.md}"
[ -f "$tasks" ] || exit 0

section=$(sed -n '/^## Current/,/^## /p' "$tasks" 2>/dev/null)
[ -z "$section" ] && exit 0

unchecked=$(echo "$section" | grep -cF -e '- [ ]' || true)
checked=$(echo "$section" | grep -cF -e '- [x]' || true)
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
  echo "NOTE: Current sprint has $unchecked open work packages — oversized. Move some back to BACKLOG.md (aim 3-6)."
  exit 0
fi

exit 0
