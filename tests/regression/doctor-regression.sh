#!/bin/bash
set -e

BASE="${TMPDIR:-/tmp}/claude-launchpad-regression"
CLI="claude-launchpad"
PASS=0
FAIL=0

green() { printf "\033[32m✓ %s\033[0m\n" "$1"; PASS=$((PASS+1)); }
red() { printf "\033[31m✗ %s\033[0m\n" "$1"; FAIL=$((FAIL+1)); }
header() { printf "\n\033[1m── %s ──\033[0m\n" "$1"; }

rm -rf "$BASE" && mkdir -p "$BASE"

# ── Scenario 1: Fresh project, no config ──
header "Scenario 1: Fresh project (no .claude/)"
S1="$BASE/s1-fresh"
mkdir -p "$S1" && cd "$S1"
git init -q && echo "# test" > README.md && git add . && git commit -qm "init"

OUTPUT=$($CLI doctor 2>&1 || true)
echo "$OUTPUT" | grep -q "No Claude Code configuration" && green "S1: doctor fails gracefully on empty project" || red "S1: doctor should report no config found"

# ── Scenario 2: Minimal config, doctor + --fix ──
header "Scenario 2: Minimal config, doctor --fix"
S2="$BASE/s2-doctor"
mkdir -p "$S2/.claude" && cd "$S2"
git init -q
echo '# Test Project' > CLAUDE.md
echo '{}' > .claude/settings.json

OUTPUT=$($CLI doctor 2>&1 || true)
echo "$OUTPUT" | grep -q "issue" && green "S2: doctor finds issues on minimal config" || red "S2: doctor should find issues"
# SessionEnd is not flagged individually when zero hooks exist (early return with "No hooks configured")
# But --fix for "No hooks configured" should add it along with other essential hooks

$CLI doctor --fix 2>&1 > /dev/null || true
cat .claude/settings.json | grep -q "PreToolUse" && green "S2: --fix added PreToolUse hooks" || red "S2: --fix should add PreToolUse hooks"
cat .claude/settings.json | grep -q "SessionStart" && green "S2: --fix added SessionStart hook" || red "S2: --fix should add SessionStart hook"
# SessionEnd should NOT be added without memory — it's memory-only
cat .claude/settings.json | grep -q "SessionEnd" && red "S2: --fix should NOT add SessionEnd without memory" || green "S2: --fix correctly skips SessionEnd without memory"
[ -f "$S2/.claudeignore" ] && green "S2: --fix created .claudeignore" || red "S2: --fix should create .claudeignore"

# ── Scenario 3: MCP security checks ──
header "Scenario 3: MCP security checks"
S3="$BASE/s3-mcp"
mkdir -p "$S3/.claude" && cd "$S3"
git init -q
echo '# Test' > CLAUDE.md
cat > .claude/settings.json <<'EOF'
{
  "mcpServers": {
    "my-server": {
      "transport": "stdio",
      "command": "npx my-mcp-server"
    }
  }
}
EOF

OUTPUT=$($CLI doctor 2>&1 || true)
echo "$OUTPUT" | grep -q "allowedMcpServers" && green "S3: doctor flags missing allowedMcpServers" || red "S3: doctor should flag missing allowedMcpServers"

$CLI doctor --fix 2>&1 > /dev/null || true
cat .claude/settings.json | grep -q "allowedMcpServers" && green "S3: --fix added allowedMcpServers" || red "S3: --fix should add allowedMcpServers"
cat .claude/settings.json | grep -q "my-server" && green "S3: allowedMcpServers contains server name" || red "S3: allowedMcpServers should contain server name"

# ── Scenario 4: Memory project without SessionEnd push ──
header "Scenario 4: Memory project without SessionEnd push"
S4="$BASE/s4-memory"
mkdir -p "$S4/.claude" && cd "$S4"
git init -q
cat > CLAUDE.md <<'EOF'
# Test
## Memory
Use agentic-memory
EOF
cat > .claude/settings.json <<'EOF'
{
  "autoMemoryEnabled": false,
  "hooks": {
    "SessionStart": [{
      "matcher": "startup|resume",
      "hooks": [{"type": "command", "command": "npx claude-launchpad memory context --json 2>/dev/null; exit 0"}]
    }]
  },
  "permissions": {
    "allow": [
      "mcp__agentic-memory__memory_store",
      "mcp__agentic-memory__memory_search",
      "mcp__agentic-memory__memory_recent",
      "mcp__agentic-memory__memory_forget",
      "mcp__agentic-memory__memory_relate",
      "mcp__agentic-memory__memory_stats",
      "mcp__agentic-memory__memory_update"
    ],
    "deny": ["Read(~/.ssh/*)", "Read(~/.aws/*)", "Read(~/.npmrc)"]
  },
  "disableBypassPermissionsMode": "disable",
  "sandbox": {"enabled": true, "failIfUnavailable": true},
  "mcpServers": {
    "agentic-memory": {
      "transport": "stdio",
      "command": "npx claude-launchpad memory serve"
    }
  }
}
EOF

# Pre-set placement to avoid interactive prompt
mkdir -p .claude
echo '{"memoryPlacement":"shared"}' > .claude/settings.local.json

OUTPUT=$($CLI doctor 2>&1 || true)
echo "$OUTPUT" | grep -q "SessionEnd" && green "S4: doctor flags missing SessionEnd hook" || red "S4: doctor should flag SessionEnd hook"
echo "$OUTPUT" | grep -q "SessionStart.*auto-pull" && green "S4: doctor flags missing SessionStart pull hook" || red "S4: doctor should flag SessionStart pull hook"

$CLI doctor --fix 2>&1 > /dev/null || true
cat .claude/settings.json | grep -q "SessionEnd" && green "S4: --fix added SessionEnd hook" || red "S4: --fix should add SessionEnd hook"
cat .claude/settings.json | grep -q "memory push" && green "S4: SessionEnd hook contains memory push" || red "S4: SessionEnd hook should push memories"
cat .claude/settings.json | grep -q "memory pull" && green "S4: --fix added SessionStart pull hook" || red "S4: --fix should add SessionStart pull hook"

# ── Scenario 5: Perfect project — no issues ──
header "Scenario 5: Fully configured project"
S5="$BASE/s5-perfect"
mkdir -p "$S5/.claude/rules" "$S5/.claude/skills/lp-enhance" && cd "$S5"
git init -q
cat > CLAUDE.md <<'EOF'
# Test
## Stack
- TypeScript
## Architecture
- src/ dir
## Commands
- npm test
## Session Start
- Read TASKS.md
## Backlog
- Check BACKLOG.md
## Off-Limits
- Never hardcode secrets
EOF
echo "# Backlog" > BACKLOG.md
printf "node_modules\n.env\n" > .claudeignore
echo "# A substantial rules file with enough content" > .claude/rules/conventions.md
# Skill needs version marker to pass outdated check
printf -- "---\nname: lp-enhance\n---\n<!-- lp-enhance-version: 5 -->\n# Enhance skill" > .claude/skills/lp-enhance/SKILL.md
cat > .claude/settings.json <<'EOF'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read|Write|Edit",
        "hooks": [{"type": "command", "command": "echo .env block"}]
      },
      {
        "matcher": "Bash",
        "hooks": [{"type": "command", "command": "echo force push check"}]
      }
    ],
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{"type": "command", "command": "prettier --write $FILE"}]
    }],
    "PostCompact": [{
      "hooks": [{"type": "command", "command": "cat TASKS.md"}]
    }],
    "SessionStart": [{
      "hooks": [{"type": "command", "command": "cat TASKS.md"}]
    }],
    "SessionEnd": [{
      "hooks": [{"type": "command", "command": "echo done"}]
    }]
  },
  "permissions": {
    "deny": ["Read(~/.ssh/*)", "Read(~/.aws/*)", "Read(~/.npmrc)"]
  },
  "disableBypassPermissionsMode": "disable",
  "sandbox": {"enabled": true, "failIfUnavailable": true}
}
EOF

OUTPUT=$($CLI doctor 2>&1 || true)
echo "$OUTPUT" | grep -q "No issues found" && green "S5: perfect project has no issues" || red "S5: perfect project should have no issues"

# ── Scenario 6: JSON output ──
header "Scenario 6: JSON output"
S6="$BASE/s6-json"
mkdir -p "$S6/.claude" && cd "$S6"
git init -q
echo '# Test' > CLAUDE.md
cat > .claude/settings.json <<'EOF'
{
  "hooks": {
    "PreToolUse": [{"hooks": [{"type": "command", "command": "echo test"}]}]
  },
  "mcpServers": {
    "test-server": {"transport": "stdio", "command": "npx test"}
  }
}
EOF
OUTPUT=$($CLI doctor --json 2>&1 || true)
echo "$OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); issues=[i for a in d['analyzers'] for i in a['issues']]; assert any('allowedMcpServers' in i['message'] for i in issues)" 2>/dev/null && green "S6: JSON includes allowedMcpServers issue" || red "S6: JSON should include allowedMcpServers issue"
# SessionEnd only appears for memory projects — test on S4's pre-fix state
S6M="$BASE/s6-memory-json"
mkdir -p "$S6M/.claude" && cd "$S6M"
git init -q
echo -e "# Test\n## Memory\nUse agentic-memory" > CLAUDE.md
echo '{"memoryPlacement":"shared"}' > .claude/settings.local.json
cat > .claude/settings.json <<'EOF'
{
  "autoMemoryEnabled": false,
  "hooks": {"SessionStart": [{"hooks": [{"type": "command", "command": "memory context"}]}]},
  "permissions": {"allow": ["mcp__agentic-memory__memory_store","mcp__agentic-memory__memory_search","mcp__agentic-memory__memory_recent","mcp__agentic-memory__memory_forget","mcp__agentic-memory__memory_relate","mcp__agentic-memory__memory_stats","mcp__agentic-memory__memory_update"]},
  "mcpServers": {"agentic-memory": {"transport": "stdio", "command": "npx claude-launchpad memory serve"}}
}
EOF
OUTPUT=$($CLI doctor --json 2>&1 || true)
echo "$OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); issues=[i for a in d['analyzers'] for i in a['issues']]; assert any('SessionEnd' in i['message'] for i in issues)" 2>/dev/null && green "S6: JSON includes SessionEnd for memory project" || red "S6: JSON should include SessionEnd for memory project"

# ── Scenario 8: Memory detected via .mcp.json ──
header "Scenario 8: .mcp.json memory detection"
S8="$BASE/s8-mcp-json"
mkdir -p "$S8/.claude" && cd "$S8"
git init -q
echo -e "# Test\n## Memory\nUse agentic-memory" > CLAUDE.md
echo '{"memoryPlacement":"shared"}' > .claude/settings.local.json
cat > .mcp.json <<'EOF'
{
  "mcpServers": {
    "agentic-memory": {
      "type": "stdio",
      "command": "npx",
      "args": ["claude-launchpad", "memory", "serve"]
    }
  }
}
EOF
cat > .claude/settings.json <<'EOF'
{
  "autoMemoryEnabled": false,
  "hooks": {"SessionStart": [{"matcher":"startup|resume","hooks": [{"type": "command", "command": "npx claude-launchpad memory context --json 2>/dev/null; exit 0"}]}]},
  "permissions": {"allow": ["mcp__agentic-memory__memory_store","mcp__agentic-memory__memory_search","mcp__agentic-memory__memory_recent","mcp__agentic-memory__memory_forget","mcp__agentic-memory__memory_relate","mcp__agentic-memory__memory_stats","mcp__agentic-memory__memory_update"]}
}
EOF
OUTPUT=$($CLI doctor --json 2>&1 || true)
echo "$OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); names=[a['name'] for a in d['analyzers']]; assert 'Memory' in names" 2>/dev/null && green "S8: doctor detects memory via .mcp.json" || red "S8: doctor should detect memory via .mcp.json"
echo "$OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); mem=[a for a in d['analyzers'] if a['name']=='Memory'][0]; assert len(mem['issues'])==0 or all(i['severity']!='high' and i['severity']!='critical' for i in mem['issues'])" 2>/dev/null && green "S8: no high/critical memory issues with .mcp.json setup" || red "S8: should have no high/critical memory issues"

# ── Scenario 9: MCP detected via .mcp.json for allowedMcpServers ──
header "Scenario 9: .mcp.json triggers allowedMcpServers check"
S9="$BASE/s9-mcp-json-security"
mkdir -p "$S9/.claude" && cd "$S9"
git init -q
echo '# Test' > CLAUDE.md
cat > .mcp.json <<'EOF'
{
  "mcpServers": {
    "my-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["my-mcp-server"]
    }
  }
}
EOF
cat > .claude/settings.json <<'EOF'
{}
EOF
OUTPUT=$($CLI doctor 2>&1 || true)
echo "$OUTPUT" | grep -q "allowedMcpServers" && green "S9: doctor flags allowedMcpServers for .mcp.json server" || red "S9: doctor should flag allowedMcpServers for .mcp.json server"

# ── Scenario 7: --fix is idempotent ──
header "Scenario 7: --fix idempotency"
cd "$S4"
BEFORE=$(md5 -q .claude/settings.json)
$CLI doctor --fix 2>&1 > /dev/null || true
AFTER=$(md5 -q .claude/settings.json)
[ "$BEFORE" = "$AFTER" ] && green "S7: --fix is idempotent (no changes on re-run)" || red "S7: --fix should be idempotent"

# ── Summary ──
echo ""
header "RESULTS"
printf "  Passed: %d\n" "$PASS"
printf "  Failed: %d\n" "$FAIL"
printf "  Total:  %d\n" "$((PASS+FAIL))"
[ "$FAIL" -eq 0 ] && printf "\n\033[32mAll tests passed.\033[0m\n" || printf "\n\033[31m%d test(s) failed.\033[0m\n" "$FAIL"
exit $FAIL
