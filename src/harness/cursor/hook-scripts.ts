import { access, chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FORCE_PUSH_ERE } from "../../lib/hook-input.js";

export const CURSOR_HOOK_VERSION = 2;

export const CURSOR_FORMATTERS: Record<
  string,
  { extensions: ReadonlyArray<string>; command: string }
> = {
  TypeScript: { extensions: ["ts", "tsx"], command: "npx prettier --write" },
  JavaScript: { extensions: ["js", "jsx"], command: "npx prettier --write" },
  Python: { extensions: ["py"], command: "ruff format" },
  Go: { extensions: ["go"], command: "gofmt -w" },
  Rust: { extensions: ["rs"], command: "rustfmt" },
  Ruby: { extensions: ["rb"], command: "rubocop -A" },
  Dart: { extensions: ["dart"], command: "dart format" },
  PHP: { extensions: ["php"], command: "vendor/bin/pint" },
  Kotlin: { extensions: ["kt", "kts"], command: "ktlint -F" },
  Java: { extensions: ["java"], command: "google-java-format -i" },
  Swift: { extensions: ["swift"], command: "swift-format format -i" },
  Elixir: { extensions: ["ex", "exs"], command: "mix format" },
  "C#": { extensions: ["cs"], command: "dotnet format" },
};

function header(): string {
  return `#!/usr/bin/env bash\n# lp-cursor-hook-version: ${CURSOR_HOOK_VERSION}\nset -u\n`;
}

export function envReadScript(): string {
  return `${header()}
command -v jq >/dev/null 2>&1 || { echo '{"permission":"deny"}'; exit 2; }
input=$(cat 2>/dev/null)
fp=$(echo "$input" | jq -r '.file_path // .path // empty' 2>/dev/null)
echo "$fp" | grep -qE '\\.(env|env\\..*)$' && ! echo "$fp" | grep -q '.env.example' && {
  echo '{"permission":"deny","agent_message":"BLOCKED: .env files contain secrets"}'
  exit 2
}
echo '{"permission":"allow"}'
exit 0
`;
}

export function destructiveShellScript(): string {
  return `${header()}
command -v jq >/dev/null 2>&1 || { echo '{"permission":"deny"}'; exit 2; }
input=$(cat 2>/dev/null)
cmd=$(echo "$input" | jq -r '.command // empty' 2>/dev/null)
echo "$cmd" | grep -qE 'rm\\s+-rf\\s+/|DROP\\s+TABLE|DROP\\s+DATABASE|${FORCE_PUSH_ERE}' && {
  echo '{"permission":"deny","agent_message":"BLOCKED: Destructive command detected"}'
  exit 2
}
echo '{"permission":"allow"}'
exit 0
`;
}

export function autoFormatScript(language: string | null): string {
  const config = language ? CURSOR_FORMATTERS[language] : undefined;
  if (!config) {
    return `${header()}echo '{}'\nexit 0\n`;
  }
  const extChecks = config.extensions
    .map((ext) => `[ "$ext" = "${ext}" ]`)
    .join(" || ");
  return `${header()}
command -v jq >/dev/null 2>&1 || exit 0
input=$(cat 2>/dev/null)
fp=$(echo "$input" | jq -r '.file_path // .path // empty' 2>/dev/null)
[ -n "$fp" ] || exit 0
ext="\${fp##*.}"
(${extChecks}) && ${config.command} "$fp" 2>/dev/null
echo '{}'
exit 0
`;
}

/**
 * Ported from WORKFLOW_CHECK in src/lib/hook-scripts.ts — same drift checks,
 * adapted to Cursor's postToolUse stdin shape and additional_context output.
 * Restricted to P-section entries vs '## Current Sprint' so Changelog and
 * "Depends on:" mentions never trigger false positives.
 */
export function workflowCheckScript(): string {
  return `${header()}
command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }
input=$(cat 2>/dev/null)
fp=$(echo "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
echo "$fp" | grep -qE '(^|/)(BACKLOG|TASKS)\\.md$' || { echo '{}'; exit 0; }

warnings=""
warn() { warnings="\${warnings}\$*
"; }

backlog_ids=""
if [ -f BACKLOG.md ]; then
  backlog_ids=$(awk '/^## P[0-3]/{f=1;next} /^## /{f=0} f' BACKLOG.md 2>/dev/null | grep -E '^### ' | grep -oE 'WP-[0-9]{3,}' | sort -u || true)
fi

sprint_ids=""
if [ -f TASKS.md ]; then
  sprint_ids=$(awk '/^## Current/{f=1;next} /^## /{f=0} f' TASKS.md 2>/dev/null | grep -oE 'WP-[0-9]{3,}' | sort -u || true)
fi

if [ -n "$backlog_ids" ] && [ -n "$sprint_ids" ]; then
  dupes=$(comm -12 <(printf '%s\\n' "$backlog_ids") <(printf '%s\\n' "$sprint_ids"))
  if [ -n "$dupes" ]; then
    warn "Workflow bug: WP present in BOTH a BACKLOG.md P-section and '## Current Sprint' (violates move-not-copy — see .cursor/rules/workflow.mdc): $(printf '%s ' $dupes)— move each listed WP to exactly one file."
  fi
fi

if [ -f TASKS.md ]; then
  tasks_lines=$(wc -l < TASKS.md 2>/dev/null | tr -d ' ')
  if [ "\${tasks_lines:-0}" -gt 80 ]; then
    warn "TASKS.md is $tasks_lines lines — should stay under 80. Prune Completed Sprints or Session Log."
  fi

  current_count=$(awk '/^## Current/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^[[:space:]]*- \\[[ xX]\\]' || true)
  if [ "\${current_count:-0}" -gt 15 ]; then
    warn "'## Current Sprint' has $current_count items — split the sprint (see .cursor/rules/workflow.mdc)."
  fi

  log_count=$(awk '/^## Session Log/{flag=1; next} /^## /{flag=0} flag' TASKS.md 2>/dev/null | grep -cE '^- \\*\\*' || true)
  if [ "\${log_count:-0}" -gt 3 ]; then
    warn "'## Session Log' has $log_count entries — keep to 3 max."
  fi
fi

if [ -n "$warnings" ]; then
  jq -n --arg ctx "$warnings" '{additional_context:$ctx}'
else
  echo '{}'
fi
exit 0
`;
}

/**
 * Ported from SPRINT_OPEN_CHECK in src/lib/hook-scripts.ts — after a git
 * commit, warns when the commit adds WP checkboxes to '## Current Sprint'
 * without deleting anything from BACKLOG.md (pull = move, not copy).
 */
export function sprintOpenScript(): string {
  return `${header()}
command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }
input=$(cat 2>/dev/null)
cmd=$(echo "$input" | jq -r '.command // empty' 2>/dev/null)
echo "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])git[[:space:]]+commit([[:space:]]|$)' || { echo '{}'; exit 0; }
git rev-parse --verify HEAD >/dev/null 2>&1 || { echo '{}'; exit 0; }
git show --name-only --format= HEAD 2>/dev/null | grep -qx 'TASKS.md' || { echo '{}'; exit 0; }
pulled=$(git show --format= HEAD -- TASKS.md 2>/dev/null | grep -cE '^\\+[[:space:]]*- \\[ \\] WP-' || true)
[ "\${pulled:-0}" -eq 0 ] && { echo '{}'; exit 0; }
backlog_deletions=$(git show --format= HEAD -- BACKLOG.md 2>/dev/null | grep -cE '^-[^-]' || true)
if [ "\${backlog_deletions:-0}" -eq 0 ]; then
  jq -n --arg ctx "Sprint-open hygiene: the commit you just made adds WP checkbox(es) to '## Current Sprint' but deletes nothing from BACKLOG.md. Pulling a WP means MOVING it — delete its entry from BACKLOG.md in the same commit. If these WPs came from BACKLOG.md, scrub it now and run 'git commit --amend'. If this is a fresh-scope sprint with no backlog pulls, ignore this." '{additional_context:$ctx}'
else
  echo '{}'
fi
exit 0
`;
}

export function sessionContextScript(): string {
  return `${header()}
content=$(cat TASKS.md 2>/dev/null)
command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }
jq -n --arg ctx "$content" '{additional_context:$ctx}'
exit 0
`;
}

export function sprintSizeScript(): string {
  return `${header()}
[ -f TASKS.md ] || { echo '{}'; exit 0; }
command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }
section=$(sed -n '/^## Current/,/^## /p' TASKS.md 2>/dev/null)
[ -z "$section" ] && { echo '{}'; exit 0; }
unchecked=$(echo "$section" | grep -cE '^[[:space:]]*- \\[ \\]' || true)
checked=$(echo "$section" | grep -cE '^[[:space:]]*- \\[[xX]\\]' || true)
total=$((unchecked + checked))
emit() { jq -n --arg ctx "$1" '{additional_context:$ctx}'; exit 0; }
if [ "$total" -eq 0 ]; then
  emit "NOTE: Current sprint has no work packages yet. Pull 3-6 from BACKLOG.md to start."
fi
[ "$unchecked" -eq 0 ] && { echo '{}'; exit 0; }
if [ "$unchecked" -lt 3 ]; then
  emit "NOTE: Current sprint has $unchecked open work package(s) — that's a microsprint. Pull from BACKLOG.md (aim 3-6)."
fi
if [ "$unchecked" -gt 7 ]; then
  emit "NOTE: Current sprint has $unchecked open work packages — oversized (soft target 3-6; above 15, workflow-check requires a split)."
fi
echo '{}'
exit 0
`;
}

export interface HookScriptWriteResult {
  readonly created: ReadonlyArray<string>;
  readonly preserved: ReadonlyArray<string>;
}

/**
 * Writes only the scripts that are missing — presence is checked per script,
 * so a deleted script is restored while a customized one is never touched.
 */
export async function writeCursorHookScripts(
  root: string,
  language: string | null,
): Promise<HookScriptWriteResult> {
  const hooksDir = join(root, ".cursor", "hooks");
  await mkdir(hooksDir, { recursive: true });
  const files = [
    ["env-read.sh", envReadScript()],
    ["destructive-shell.sh", destructiveShellScript()],
    ["auto-format.sh", autoFormatScript(language)],
    ["workflow-check.sh", workflowCheckScript()],
    ["sprint-open.sh", sprintOpenScript()],
    ["session-context.sh", sessionContextScript()],
    ["sprint-size.sh", sprintSizeScript()],
  ] as const;
  const created: string[] = [];
  const preserved: string[] = [];
  for (const [name, content] of files) {
    const path = join(hooksDir, name);
    if (
      await access(path)
        .then(() => true)
        .catch(() => false)
    ) {
      preserved.push(`.cursor/hooks/${name}`);
      continue;
    }
    await writeFile(path, content);
    await chmod(path, 0o755);
    created.push(`.cursor/hooks/${name}`);
  }
  return { created, preserved };
}
