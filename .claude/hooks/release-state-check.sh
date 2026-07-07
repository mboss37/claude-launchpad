#!/bin/bash
# SessionStart: inject npm publish state so no session trusts a stale Release Plan.
# TASKS.md records intent; npm is the truth. Advisory only — always exits 0.
local_v=$(jq -r .version package.json 2>/dev/null)
npm_v=$(npm view claude-launchpad dist-tags.latest --fetch-retries=0 --fetch-timeout=4000 2>/dev/null)

if [ -z "$npm_v" ]; then
  echo "release-state: npm unreachable — verify 'npm view claude-launchpad dist-tags' manually before acting on the Release Plan."
elif [ "$local_v" = "$npm_v" ]; then
  echo "release-state: npm latest = $npm_v = package.json. Everything is published."
else
  echo "release-state: npm latest is $npm_v but package.json is $local_v — unpublished work exists. If TASKS.md Release Plan disagrees, npm wins."
fi
exit 0
