#!/usr/bin/env bash
# lp-cursor-hook-version: 2
set -u

content=$(cat TASKS.md 2>/dev/null)
command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }
jq -n --arg ctx "$content" '{additional_context:$ctx}'
exit 0
