#!/usr/bin/env bash
# Canary: Launchpad eval scenarios run through Cursor Agent and report honestly.
# See docs/superpowers/plans/2026-08-30-cursor-m3-eval.md Task 6.
#
# Requirements: node 22+, jq, git, `agent` CLI on PATH, Cursor auth.
# Usage: pnpm build && bash scripts/canary-cursor-eval.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="node $REPO_ROOT/dist/cli.js"
MODEL="${CURSOR_CANARY_MODEL:-auto}"

if command -v timeout >/dev/null 2>&1; then TIMEOUT_BIN="timeout"
elif command -v gtimeout >/dev/null 2>&1; then TIMEOUT_BIN="gtimeout"
else echo "FATAL: GNU timeout not found (macOS: brew install coreutils)"; exit 1; fi

FAILURES=()
pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; FAILURES+=("$1"); }

command -v agent >/dev/null || { echo "FATAL: agent CLI not on PATH"; exit 1; }
command -v jq >/dev/null || { echo "FATAL: jq not on PATH"; exit 1; }
[ -f "$REPO_ROOT/dist/cli.js" ] || { echo "FATAL: run pnpm build first"; exit 1; }

AGENT_VERSION="$(agent --version 2>/dev/null || echo unknown)"
echo "agent version: $AGENT_VERSION"
echo "eval model: $MODEL"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/lp-cursor-eval-canary.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
echo "work: $WORK"

echo "== scaffolding Cursor eval project =="
cat > package.json <<'EOF'
{
  "name": "cursor-eval-canary",
  "private": true,
  "type": "module"
}
EOF
mkdir -p src
echo 'export const n = 1;' > src/index.ts
git init -q
git add -A
git -c user.name=canary -c user.email=c@c commit -qm seed

$CLI init --harness cursor --yes --name cursor-eval-canary \
  || { echo "FATAL: init --harness cursor failed"; exit 1; }

SCENARIOS="$WORK/canary-scenarios"
mkdir -p "$SCENARIOS/security" "$SCENARIOS/workflow"
cp "$REPO_ROOT/scenarios/security/env-protection.yaml" "$SCENARIOS/security/"
cp "$REPO_ROOT/scenarios/security/env-read-attempt.yaml" "$SCENARIOS/security/"
cp "$REPO_ROOT/scenarios/workflow/premature-victory.yaml" "$SCENARIOS/workflow/"

echo "== preflight: agent auth =="
if ! "$TIMEOUT_BIN" 120 agent --print --trust --workspace "$WORK" \
  "Reply with exactly: AUTH_OK. Do not edit files." 2>/dev/null | grep -q "AUTH_OK"; then
  echo "CANARY INFRA FAILURE: agent cannot run (auth/credits/startup) — eval not attempted."
  exit 2
fi
echo "  auth ok"

echo "== eval --harness cursor =="
set +e
"$TIMEOUT_BIN" 600 $CLI eval \
  --harness cursor \
  --scenarios "$SCENARIOS" \
  --runs 1 \
  --model "$MODEL" \
  --timeout 180000 \
  --json > eval.json
EVAL_EXIT=$?
set -e

if [ ! -s eval.json ]; then
  echo "FATAL: eval produced no JSON"
  exit 1
fi

JSON="$(python3 - <<'PY'
import json
from pathlib import Path
text = Path("eval.json").read_text()
decoder = json.JSONDecoder()
for index in range(len(text) - 1, -1, -1):
    if text[index] != "{":
        continue
    try:
        payload, _ = decoder.raw_decode(text[index:])
    except json.JSONDecodeError:
        continue
    if isinstance(payload, dict) and "results" in payload:
        print(json.dumps(payload))
        raise SystemExit(0)
raise SystemExit("no eval JSON object in output")
PY
)" || { echo "FATAL: could not extract eval JSON"; sed -n '1,80p' eval.json; exit 1; }

echo "$JSON" > eval.clean.json
echo "$JSON" | jq -e . >/dev/null \
  || { echo "FATAL: eval JSON is invalid"; sed -n '1,40p' eval.json; exit 1; }

NAMES="$(jq -r '.results[].scenario' eval.clean.json | sort | tr '\n' ' ')"
echo "scenarios: $NAMES"

if [ "$(jq -r '.harness' eval.clean.json)" = "cursor" ]; then
  pass "result metadata harness is cursor"
else
  fail "harness is $(jq -r '.harness' eval.clean.json), expected cursor"
fi

VERSION="$(jq -r '.productVersion // empty' eval.clean.json)"
if [ -n "$VERSION" ]; then
  pass "product version is non-empty ($VERSION)"
else
  fail "product version is empty"
fi

for expected in \
  "security/env-protection" \
  "security/env-read-attempt" \
  "workflow/premature-victory"
do
  if echo "$NAMES" | grep -q "$expected"; then
    pass "reported $expected"
  else
    fail "silently omitted $expected"
  fi
  SKIPPED="$(jq -r --arg n "$expected" '.results[] | select(.scenario==$n) | .skipped // false' eval.clean.json)"
  if [ "$SKIPPED" = "true" ]; then
    fail "$expected was SKIP without a live run"
  fi
done

BLOCKED="$(jq -r '.results[] | select(.scenario=="security/env-read-attempt") | .checks[] | select(.label | test("hook"; "i")) | .passed' eval.clean.json)"
if [ "$BLOCKED" = "true" ]; then
  pass "env-read scenario observed a blocking hook"
else
  fail "env-read scenario did not observe a canonical blocked event"
fi

if ls .cursor/eval/eval-*.md >/dev/null 2>&1; then
  pass "report written under .cursor/eval/"
else
  fail "no report under .cursor/eval/"
fi

echo
echo "recorded agent version: $AGENT_VERSION"
echo "eval exit: $EVAL_EXIT"
if [ ${#FAILURES[@]} -eq 0 ]; then
  echo "CANARY PASS — Cursor eval scenarios ran and reported"
  exit 0
fi
echo "CANARY FAIL — ${#FAILURES[@]} assertion(s) failed:"
printf ' - %s\n' "${FAILURES[@]}"
exit 1
