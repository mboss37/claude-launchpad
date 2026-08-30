#!/bin/bash
set -e

BASE="${TMPDIR:-/tmp}/claude-launchpad-cursor-regression"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ ! -f "$REPO_ROOT/dist/cli.js" ]; then
  echo "dist/cli.js not found — run 'pnpm build' (or use 'pnpm test:regression:cursor', which builds first)" >&2
  exit 1
fi
CLI="node $REPO_ROOT/dist/cli.js"
PASS=0
FAIL=0

green() { printf "\033[32m✓ %s\033[0m\n" "$1"; PASS=$((PASS+1)); }
red() { printf "\033[31m✗ %s\033[0m\n" "$1"; FAIL=$((FAIL+1)); }
header() { printf "\n\033[1m── %s ──\033[0m\n" "$1"; }

rm -rf "$BASE" && mkdir -p "$BASE"
export HOME="$BASE/home"
mkdir -p "$HOME"
git config --global user.email "regression@test" && git config --global user.name "regression"

header "1: Empty project diagnosis"
S1="$BASE/empty"
mkdir -p "$S1" && cd "$S1"
git init -q && echo "# test" > README.md && git add . && git commit -qm "init"
OUTPUT=$($CLI doctor --harness cursor 2>&1 || true)
echo "$OUTPUT" | grep -q "No AGENTS.md" && green "empty Cursor doctor flags missing AGENTS.md" || red "empty Cursor doctor should flag missing AGENTS.md"

header "2-8: Cursor-only init and doctor"
S2="$BASE/cursor-only"
mkdir -p "$S2" && cd "$S2"
git init -q && echo "# test" > README.md && git add . && git commit -qm "init"
$CLI init --harness cursor --yes --name demo >/dev/null
for path in AGENTS.md TASKS.md BACKLOG.md .cursor/hooks.json .cursorignore \
  .cursor/rules/conventions.mdc .cursor/rules/workflow.mdc .cursor/rules/hooks.mdc \
  .cursor/rules/verification.mdc .cursor/agents/code-reviewer.md \
  .cursor/skills/lp-enhance/SKILL.md; do
  [ -f "$S2/$path" ] && green "init created $path" || red "init should create $path"
done
[ ! -f "$S2/CLAUDE.md" ] && green "cursor-only init did not create CLAUDE.md" || red "cursor-only init must not create CLAUDE.md"

HUMAN=$($CLI doctor --harness cursor 2>&1 || true)
echo "$HUMAN" | grep -q "Cursor Agent" && green "human doctor names Cursor Agent" || red "human doctor should name Cursor Agent"

JSON=$($CLI doctor --harness cursor --json)
echo "$JSON" | grep -q '"overallScore"' && green "JSON doctor includes overallScore" || red "JSON doctor should include overallScore"
echo "$JSON" | grep -q '"analyzers"' && green "JSON doctor includes analyzers" || red "JSON doctor should include analyzers"

set +e
$CLI doctor --harness cursor --min-score 101 >/dev/null 2>&1
MIN_EXIT=$?
set -e
[ "$MIN_EXIT" -ne 0 ] && green "min-score 101 exits non-zero" || red "min-score 101 should fail"

HASH_BEFORE=$(if command -v md5 >/dev/null 2>&1; then md5 -q AGENTS.md; else md5sum AGENTS.md | cut -d' ' -f1; fi)
$CLI init --harness cursor --yes --name demo >/dev/null
HASH_AFTER=$(if command -v md5 >/dev/null 2>&1; then md5 -q AGENTS.md; else md5sum AGENTS.md | cut -d' ' -f1; fi)
[ "$HASH_BEFORE" = "$HASH_AFTER" ] && green "second init is idempotent" || red "second init should not rewrite AGENTS.md"

header "9: Both-mode reports"
S3="$BASE/both"
mkdir -p "$S3" && cd "$S3"
git init -q && echo "# test" > README.md && git add . && git commit -qm "init"
$CLI init --harness both --yes --name demo >/dev/null
BOTH=$($CLI doctor --harness both --json)
echo "$BOTH" | grep -q '"claude"' && echo "$BOTH" | grep -q '"cursor"' && green "both-mode JSON has separate harness reports" || red "both-mode JSON should include claude and cursor"

header "10: Claude-only project with an IDE .cursor dir stays Claude-only"
S5="$BASE/claude-with-ide-cursor"
mkdir -p "$S5/.cursor" && cd "$S5"
git init -q && echo "# test" > README.md && git add . && git commit -qm "init"
$CLI init --yes --name demo >/dev/null
echo '{}' > .cursor/mcp.json
JSON=$($CLI doctor --json)
echo "$JSON" | grep -q '"overallScore"' && ! echo "$JSON" | grep -q '"harnesses"' \
  && green "auto doctor keeps the Claude JSON shape" || red "auto doctor must not switch to both-mode JSON"
FIX_OUT=$($CLI doctor --fix 2>&1 || true)
echo "$FIX_OUT" | grep -q "Cursor --fix is not available" \
  && red "doctor --fix must keep working with an IDE-only .cursor dir" \
  || green "doctor --fix still works with an IDE-only .cursor dir"

header "11: Malformed hooks.json is not clobbered"
S4="$BASE/malformed"
mkdir -p "$S4/.cursor" && cd "$S4"
git init -q
echo "{ invalid" > .cursor/hooks.json
BEFORE=$(cat .cursor/hooks.json)
OUTPUT=$($CLI doctor --harness cursor 2>&1 || true)
AFTER=$(cat .cursor/hooks.json)
echo "$OUTPUT" | grep -q "Invalid JSON" && green "doctor reports malformed hooks.json" || red "doctor should report Invalid JSON"
[ "$BEFORE" = "$AFTER" ] && green "malformed hooks.json left untouched" || red "doctor must not clobber malformed hooks.json"

echo
echo "Passed: $PASS  Failed: $FAIL"
[ "$FAIL" -eq 0 ]
