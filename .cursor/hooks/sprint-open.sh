#!/usr/bin/env bash
# lp-cursor-hook-version: 2
set -u

command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }
input=$(cat 2>/dev/null)
cmd=$(echo "$input" | jq -r '.command // empty' 2>/dev/null)
echo "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])git[[:space:]]+commit([[:space:]]|$)' || { echo '{}'; exit 0; }
git rev-parse --verify HEAD >/dev/null 2>&1 || { echo '{}'; exit 0; }
git show --name-only --format= HEAD 2>/dev/null | grep -qx 'TASKS.md' || { echo '{}'; exit 0; }
pulled=$(git show --format= HEAD -- TASKS.md 2>/dev/null | grep -cE '^\+[[:space:]]*- \[ \] WP-' || true)
[ "${pulled:-0}" -eq 0 ] && { echo '{}'; exit 0; }
backlog_deletions=$(git show --format= HEAD -- BACKLOG.md 2>/dev/null | grep -cE '^-[^-]' || true)
if [ "${backlog_deletions:-0}" -eq 0 ]; then
  jq -n --arg ctx "Sprint-open hygiene: the commit you just made adds WP checkbox(es) to '## Current Sprint' but deletes nothing from BACKLOG.md. Pulling a WP means MOVING it — delete its entry from BACKLOG.md in the same commit. If these WPs came from BACKLOG.md, scrub it now and run 'git commit --amend'. If this is a fresh-scope sprint with no backlog pulls, ignore this." '{additional_context:$ctx}'
else
  echo '{}'
fi
exit 0
