import { writeFile, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import { jqField } from "./hook-input.js";

export const SPRINT_SIZE_CHECK = `#!/usr/bin/env bash
# Warns when the current sprint is too small (<3) or too large (>7 soft; 15 is
# the hard split trigger enforced by workflow-check). Sweet spot is 3-6 work
# packages. Runs on SessionStart, whose stdout is injected into context.
# Non-blocking (always exits 0).

set -u
tasks="\${1:-TASKS.md}"
[ -f "$tasks" ] || exit 0

section=$(sed -n '/^## Current/,/^## /p' "$tasks" 2>/dev/null)
[ -z "$section" ] && exit 0

# Anchored so placeholder comments containing "- [ ]" don't count as WPs.
unchecked=$(echo "$section" | grep -cE '^[[:space:]]*- \\[ \\]' || true)
checked=$(echo "$section" | grep -cE '^[[:space:]]*- \\[[xX]\\]' || true)
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
  echo "NOTE: Current sprint has $unchecked open work packages — oversized (soft target 3-6; above 15, workflow-check requires a split)."
  exit 0
fi

exit 0
`;

export const SPRINT_OPEN_CHECK = `#!/usr/bin/env bash
# After a git commit, warns when the commit adds WP checkboxes to
# '## Current Sprint' without deleting anything from BACKLOG.md — i.e. the
# "pull = move, not copy" rule was skipped. Runs on PostToolUse (Bash):
# PreToolUse has no non-blocking way to reach the model, so instead of
# blocking the commit we suggest an amend. Warning is emitted as
# additionalContext JSON — bare stdout on PostToolUse never reaches the model.
# Non-blocking (always exits 0).

set -u
command -v jq >/dev/null 2>&1 || exit 0
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null)

# Only act on \\\`git commit\\\`, word-boundary match.
echo "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])git[[:space:]]+commit([[:space:]]|$)' || exit 0

git rev-parse --verify HEAD >/dev/null 2>&1 || exit 0

# The commit must touch TASKS.md and add unchecked WP lines to it.
git show --name-only --format= HEAD 2>/dev/null | grep -qx 'TASKS.md' || exit 0
pulled=$(git show --format= HEAD -- TASKS.md 2>/dev/null | grep -cE '^\\+[[:space:]]*- \\[ \\] WP-' || true)
[ "\${pulled:-0}" -eq 0 ] && exit 0

# A pull commit should also delete the WP bodies from BACKLOG.md.
backlog_deletions=$(git show --format= HEAD -- BACKLOG.md 2>/dev/null | grep -cE '^-[^-]' || true)
if [ "\${backlog_deletions:-0}" -eq 0 ]; then
  jq -n --arg ctx "Sprint-open hygiene: the commit you just made adds WP checkbox(es) to '## Current Sprint' but deletes nothing from BACKLOG.md. Pulling a WP means MOVING it — delete its entry from BACKLOG.md in the same commit. If these WPs came from BACKLOG.md, scrub it now and run 'git commit --amend'. If this is a fresh-scope sprint with no backlog pulls, ignore this." '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'
fi

exit 0
`;

export const WORKFLOW_CHECK = `#!/usr/bin/env bash
# Warns on BACKLOG.md / TASKS.md drift. Non-blocking (always exits 0).
# Warnings are emitted as PostToolUse additionalContext JSON so they reach
# the model — bare stdout on PostToolUse only reaches the transcript view.
#   1. A WP entry lives in a BACKLOG.md P-section AND in '## Current Sprint'
#      (violates move-not-copy). Changelog + "Depends on:" mentions are fine.
#   2. TASKS.md longer than 80 lines.
#   3. '## Current Sprint' has more than 15 items (hard split trigger).
#   4. '## Session Log' has more than 3 entries.
#   5. A pulled WP's "Depends on:" dependency still sits in a P-section.

set -u
command -v jq >/dev/null 2>&1 || exit 0
fp=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Only act on edits to BACKLOG.md or TASKS.md.
echo "$fp" | grep -qE '(^|/)(BACKLOG|TASKS)\\.md$' || exit 0

warnings=""
warn() { warnings="\${warnings}\$*
"; }

# WP IDs that live as entries in BACKLOG P-sections (not Changelog, not Depends-on).
backlog_ids=""
if [ -f BACKLOG.md ]; then
  backlog_ids=$(awk '/^## P[0-3]/{f=1;next} /^## /{f=0} f' BACKLOG.md 2>/dev/null | grep -E '^### ' | grep -oE 'WP-[0-9]{3,}' | sort -u || true)
fi

# WP IDs in the Current Sprint checklist.
sprint_ids=""
if [ -f TASKS.md ]; then
  sprint_ids=$(awk '/^## Current/{f=1;next} /^## /{f=0} f' TASKS.md 2>/dev/null | grep -oE 'WP-[0-9]{3,}' | sort -u || true)
fi

# 1. Same WP as a live entry in both files.
if [ -n "$backlog_ids" ] && [ -n "$sprint_ids" ]; then
  dupes=$(comm -12 <(printf '%s\\n' "$backlog_ids") <(printf '%s\\n' "$sprint_ids"))
  if [ -n "$dupes" ]; then
    warn "Workflow bug: WP present in BOTH a BACKLOG.md P-section and '## Current Sprint' (violates move-not-copy — see .claude/rules/workflow.md): $(printf '%s ' $dupes)— move each listed WP to exactly one file."
  fi
fi

if [ -f TASKS.md ]; then
  # 2. TASKS.md length.
  tasks_lines=$(wc -l < TASKS.md 2>/dev/null | tr -d ' ')
  if [ "\${tasks_lines:-0}" -gt 80 ]; then
    warn "TASKS.md is $tasks_lines lines — should stay under 80. Prune Completed Sprints or Session Log."
  fi

  # 3. Current Sprint size (hard trigger; the soft target is 3-6).
  current_count=$(awk '/^## Current/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^[[:space:]]*- \\[[ xX]\\]' || true)
  if [ "\${current_count:-0}" -gt 15 ]; then
    warn "'## Current Sprint' has $current_count items — split the sprint (see .claude/rules/workflow.md)."
  fi

  # 4. Session Log size.
  log_count=$(awk '/^## Session Log/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^- \\*\\*' || true)
  if [ "\${log_count:-0}" -gt 3 ]; then
    warn "'## Session Log' has $log_count entries — keep to 3 max."
  fi
fi

# 5. Dependency-aware pulls: the pulled WP's 7-field body left BACKLOG.md, but
# HEAD's copy (pre-pull) still records its "Depends on:" line.
if [ -n "$sprint_ids" ] && git rev-parse --verify HEAD >/dev/null 2>&1; then
  for wp in $sprint_ids; do
    deps=$( { git show HEAD:BACKLOG.md 2>/dev/null; cat BACKLOG.md 2>/dev/null; } | awk -v id="$wp" '$0 ~ "^### "id" "{f=1;next} /^### /{f=0} f && /Depends on:/{print}' | grep -oE 'WP-[0-9]{3,}' | sort -u || true)
    for dep in $deps; do
      if printf '%s\\n' "$backlog_ids" | grep -qx "$dep"; then
        warn "$wp was pulled into the sprint but its dependency $dep is still in BACKLOG.md — pull $dep too, or move $wp back until $dep ships."
      fi
    done
  done
fi

if [ -n "$warnings" ]; then
  jq -n --arg ctx "$warnings" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'
fi
exit 0
`;

// ─── Shared hook command strings (single source: init generator + doctor fixers) ───

/**
 * When every Current Sprint checkbox flips to [x], nudge the model to run
 * /code-review before the closing commit. Emitted as additionalContext JSON —
 * bare PostToolUse stdout never reaches the model. Counts are anchored so
 * placeholder comments containing "- [ ]" don't register as open WPs.
 */
export const SPRINT_COMPLETE_NUDGE = `fp=${jqField("file_path")}; echo "$fp" | grep -q TASKS.md || exit 0; section=$(sed -n '/^## Current/,/^## /p' TASKS.md 2>/dev/null); [ -z "$section" ] && exit 0; unchecked=$(echo "$section" | grep -cE '^[[:space:]]*- \\[ \\]' || true); checked=$(echo "$section" | grep -cE '^[[:space:]]*- \\[[xX]\\]' || true); [ "$unchecked" -eq 0 ] && [ "$checked" -gt 0 ] && jq -n --arg ctx 'Sprint complete - all Current Sprint tasks are checked off. Run /code-review on the sprint diff (base: the last chore(sprint- commit)) and fix Critical/Important findings before the closing commit. Skip if the sprint was trivial (docs/config only).' '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$ctx}}'; exit 0`;

export const WORKFLOW_CHECK_WRAPPER = "bash .claude/hooks/workflow-check.sh; exit 0";
export const SPRINT_OPEN_WRAPPER = "bash .claude/hooks/sprint-open-check.sh; exit 0";
export const SPRINT_SIZE_WRAPPER = "bash .claude/hooks/sprint-size-check.sh TASKS.md 2>/dev/null; exit 0";

/** SessionStart matcher incl. compact/clear — there is no PostCompact hook event. */
export const SESSION_START_MATCHER = "startup|resume|compact|clear";

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
