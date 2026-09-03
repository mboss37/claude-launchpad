#!/usr/bin/env bash
# lp-cursor-hook-version: 2
set -u

command -v jq >/dev/null 2>&1 || exit 0
input=$(cat 2>/dev/null)
fp=$(echo "$input" | jq -r '.file_path // .path // empty' 2>/dev/null)
[ -n "$fp" ] || exit 0
ext="${fp##*.}"
([ "$ext" = "ts" ] || [ "$ext" = "tsx" ]) && npx prettier --write "$fp" 2>/dev/null
echo '{}'
exit 0
