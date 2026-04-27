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
