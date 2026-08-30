import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { FORCE_PUSH_ERE } from "../../lib/hook-input.js";

export const CURSOR_HOOK_VERSION = 1;

const FORMATTERS: Record<
  string,
  { extensions: ReadonlyArray<string>; command: string }
> = {
  TypeScript: { extensions: ["ts", "tsx"], command: "npx prettier --write" },
  JavaScript: { extensions: ["js", "jsx"], command: "npx prettier --write" },
  Python: { extensions: ["py"], command: "ruff format" },
  Go: { extensions: ["go"], command: "gofmt -w" },
  Rust: { extensions: ["rs"], command: "rustfmt" },
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
  const config = language ? FORMATTERS[language] : undefined;
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

export function workflowCheckScript(): string {
  return `${header()}
[ -f BACKLOG.md ] && [ -f TASKS.md ] || { echo '{}'; exit 0; }
dups=$(grep -ohE 'WP-[0-9]+' BACKLOG.md TASKS.md 2>/dev/null | sort | uniq -d | tr '\\n' ' ')
[ -z "$dups" ] && { echo '{}'; exit 0; }
command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }
jq -n --arg ctx "Workflow warning: WP IDs appear in both BACKLOG.md and TASKS.md: $dups" '{additional_context:$ctx}'
exit 0
`;
}

export function sprintOpenScript(): string {
  return `${header()}
command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }
input=$(cat 2>/dev/null)
cmd=$(echo "$input" | jq -r '.command // empty' 2>/dev/null)
echo "$cmd" | grep -qE '(^|[^a-zA-Z0-9_-])git[[:space:]]+commit([[:space:]]|$)' || { echo '{}'; exit 0; }
echo '{}'
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
section=$(sed -n '/^## Current/,/^## /p' TASKS.md 2>/dev/null)
unchecked=$(echo "$section" | grep -cE '^[[:space:]]*- \\[ \\]' || true)
command -v jq >/dev/null 2>&1 || { echo '{}'; exit 0; }
if [ "$unchecked" -gt 0 ] && [ "$unchecked" -lt 3 ]; then
  jq -n --arg ctx "NOTE: Current sprint has $unchecked open work package(s)." '{additional_context:$ctx}'
  exit 0
fi
echo '{}'
exit 0
`;
}

export async function writeCursorHookScripts(
  root: string,
  language: string | null,
): Promise<ReadonlyArray<string>> {
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
  const written: string[] = [];
  for (const [name, content] of files) {
    const path = join(hooksDir, name);
    await writeFile(path, content);
    await chmod(path, 0o755);
    written.push(`.cursor/hooks/${name}`);
  }
  return written;
}
