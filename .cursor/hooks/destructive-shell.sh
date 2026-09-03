#!/usr/bin/env bash
# lp-cursor-hook-version: 2
set -u

command -v jq >/dev/null 2>&1 || { echo '{"permission":"deny"}'; exit 2; }
input=$(cat 2>/dev/null)
cmd=$(echo "$input" | jq -r '.command // empty' 2>/dev/null)
echo "$cmd" | grep -qE 'rm\s+-rf\s+/|DROP\s+TABLE|DROP\s+DATABASE|git +(-[cC][^ ]* +([^ ]+ +)?)*push([^|;&]*( -[a-zA-Z]*f[a-zA-Z]*| --force| --force-with-lease(=[^ ;|&]*)?)( |$|;|&)|[^|;&]* \+[^ ;|&]+)' && {
  echo '{"permission":"deny","agent_message":"BLOCKED: Destructive command detected"}'
  exit 2
}
echo '{"permission":"allow"}'
exit 0
