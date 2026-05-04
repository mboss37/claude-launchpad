import { writeFile, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";

export const SPRINT_SIZE_CHECK = `#!/usr/bin/env bash
# Warns when the current sprint is too small (<3) or too large (>7).
# Sweet spot is 3-6 work packages per sprint. Non-blocking (always exits 0).

set -u
tasks="\${1:-TASKS.md}"
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
`;

export const SPRINT_OPEN_CHECK = `#!/usr/bin/env bash
# Warns when TASKS.md opens a new sprint block but BACKLOG.md has no staged
# deletions, i.e. the "remove pulled WPs from BACKLOG in the same edit" rule
# from CLAUDE.md was skipped. Non-blocking (always exits 0).

set -u
cmd="\${TOOL_INPUT_COMMAND:-}"

# Only act on \`git commit\`, word-boundary match.
echo "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])git[[:space:]]+commit([[:space:]]|$)' || exit 0

# Nothing staged
git diff --cached --quiet 2>/dev/null && exit 0

# TASKS.md not staged
git diff --cached --name-only --diff-filter=ACM 2>/dev/null | grep -q '^TASKS\\.md$' || exit 0

# Does the staged TASKS.md diff ADD a new \`## Current\` block?
new_sprint=$(git diff --cached TASKS.md 2>/dev/null | grep -cE '^\\+## Current')
[ "$new_sprint" -eq 0 ] && exit 0

# If a new sprint was opened, BACKLOG.md should have net deletions.
backlog_deletions=$(git diff --cached BACKLOG.md 2>/dev/null | grep -cE '^-[^-]')
if [ "$backlog_deletions" -eq 0 ]; then
  echo ""
  echo "WARNING: sprint-open hygiene"
  echo ""
  echo "TASKS.md stages a new '## Current' block, but BACKLOG.md has no"
  echo "staged deletions. When a WP is pulled from BACKLOG.md into a sprint,"
  echo "remove it from BACKLOG.md in the same edit. Overlap = drift."
  echo ""
  echo "If you opened a fresh-scope sprint with no BACKLOG pulls, ignore"
  echo "this. Otherwise scrub BACKLOG.md before committing."
  echo ""
fi

exit 0
`;

export const WORKFLOW_CHECK = `#!/usr/bin/env bash
# Warns on BACKLOG.md / TASKS.md drift. Non-blocking (always exits 0).
#   1. Same WP ID present in BOTH BACKLOG.md and TASKS.md (violates move-not-copy).
#   2. TASKS.md longer than 80 lines.
#   3. \\\`## Current Sprint\\\` contains more than 15 items.
#   4. \\\`## Session Log\\\` has more than 3 entries.

set -u
fp="\${TOOL_INPUT_FILE_PATH:-}"

# Only act on edits to BACKLOG.md or TASKS.md.
echo "$fp" | grep -qE '(^|/)(BACKLOG|TASKS)\\.md$' || exit 0

warn() { printf '%s\\n' "$*"; }

# 1. Duplicate WP IDs across both files.
if [ -f BACKLOG.md ] && [ -f TASKS.md ]; then
  dupes=$(grep -oE 'WP-[0-9]{3}' BACKLOG.md 2>/dev/null | sort -u | while read -r wp; do
    grep -q "$wp" TASKS.md 2>/dev/null && echo "$wp"
  done)
  if [ -n "$dupes" ]; then
    warn "Workflow bug: WP ID present in BOTH BACKLOG.md and TASKS.md (violates move-not-copy — see .claude/rules/workflow.md):"
    printf '%s\\n' "$dupes"
    warn "Move each listed WP to exactly one file."
  fi
fi

# 2. TASKS.md length.
if [ -f TASKS.md ]; then
  tasks_lines=$(wc -l < TASKS.md 2>/dev/null | tr -d ' ')
  if [ "\${tasks_lines:-0}" -gt 80 ]; then
    warn "TASKS.md is $tasks_lines lines — should stay under 80. Prune Completed Sprints or Session Log."
  fi

  # 3. Current Sprint size.
  current_count=$(awk '/^## Current/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^[[:space:]]*- \\[[ x]\\]' || true)
  if [ "\${current_count:-0}" -gt 15 ]; then
    warn "## Current Sprint has $current_count items — split the sprint (see .claude/rules/workflow.md)."
  fi

  # 4. Session Log size.
  log_count=$(awk '/^## Session Log/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^- \\*\\*' || true)
  if [ "\${log_count:-0}" -gt 3 ]; then
    warn "## Session Log has $log_count entries — keep to 3 max."
  fi
fi

exit 0
`;

export interface InstalledScripts {
  readonly sizePath: string;
  readonly openPath: string;
}

export async function writeSprintHygieneScripts(root: string): Promise<InstalledScripts> {
  const hooksDir = join(root, ".claude", "hooks");
  await mkdir(hooksDir, { recursive: true });
  const sizePath = join(hooksDir, "sprint-size-check.sh");
  const openPath = join(hooksDir, "sprint-open-check.sh");
  await writeFile(sizePath, SPRINT_SIZE_CHECK);
  await writeFile(openPath, SPRINT_OPEN_CHECK);
  await chmod(sizePath, 0o755);
  await chmod(openPath, 0o755);
  return { sizePath, openPath };
}

export async function writeWorkflowCheckScript(root: string): Promise<string> {
  const hooksDir = join(root, ".claude", "hooks");
  await mkdir(hooksDir, { recursive: true });
  const scriptPath = join(hooksDir, "workflow-check.sh");
  await writeFile(scriptPath, WORKFLOW_CHECK);
  await chmod(scriptPath, 0o755);
  return scriptPath;
}
