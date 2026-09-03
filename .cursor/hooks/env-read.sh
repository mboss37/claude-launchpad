#!/usr/bin/env bash
# lp-cursor-hook-version: 2
set -u

command -v jq >/dev/null 2>&1 || { echo '{"permission":"deny"}'; exit 2; }
input=$(cat 2>/dev/null)
fp=$(echo "$input" | jq -r '.file_path // .path // empty' 2>/dev/null)
echo "$fp" | grep -qE '\.(env|env\..*)$' && ! echo "$fp" | grep -q '.env.example' && {
  echo '{"permission":"deny","agent_message":"BLOCKED: .env files contain secrets"}'
  exit 2
}
echo '{"permission":"allow"}'
exit 0
