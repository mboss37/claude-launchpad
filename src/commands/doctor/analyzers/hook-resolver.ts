/**
 * Hook command resolver — transitively expands one level of shell-wrapper indirection.
 *
 * A Claude Code hook like `bash .claude/session-start.sh` delegates capability to a
 * wrapper script. Analyzers inspecting only the literal `command` string miss the
 * wrapper's body. This resolver returns the command text + bodies of referenced .sh
 * files inside the project root so analyzers can run `.includes()` against a single
 * "effective command" string.
 *
 * Depth limit: 1 (no recursion into scripts-that-call-scripts).
 * Extension limit: only `.sh` is followed.
 * Root boundary: only paths resolving (via realpath) inside projectRoot are read.
 */

import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { parse } from "shell-quote";

export interface HookExpansion {
  readonly path: string;
  readonly body: string;
}

export interface ResolvedHookCommand {
  readonly command: string;
  readonly expansions: readonly HookExpansion[];
  readonly missingScripts: readonly string[];
}

export async function resolveHookCommand(
  hook: { readonly command?: string | null },
  projectRoot: string,
): Promise<ResolvedHookCommand> {
  const command = hook.command ?? "";
  if (!command) return { command: "", expansions: [], missingScripts: [] };

  const scriptPaths = extractShellScripts(command);
  if (scriptPaths.length === 0) return { command, expansions: [], missingScripts: [] };

  let projectRootReal: string;
  try {
    projectRootReal = await realpath(projectRoot);
  } catch {
    return { command, expansions: [], missingScripts: [] };
  }

  const expansions: HookExpansion[] = [];
  const missingScripts: string[] = [];

  for (const relPath of scriptPaths) {
    const resolved = resolve(projectRoot, relPath);
    let realResolved: string;
    try {
      realResolved = await realpath(resolved);
    } catch {
      missingScripts.push(relPath);
      continue;
    }
    if (realResolved !== projectRootReal && !realResolved.startsWith(projectRootReal + sep)) {
      continue;
    }
    try {
      const body = await readFile(realResolved, "utf-8");
      expansions.push({ path: relPath, body });
    } catch {
      missingScripts.push(relPath);
    }
  }

  return { command, expansions, missingScripts };
}

export function effectiveCommandText(resolved: ResolvedHookCommand): string {
  if (resolved.expansions.length === 0) return resolved.command;
  return resolved.command + "\n" + resolved.expansions.map((e) => e.body).join("\n");
}

function extractShellScripts(command: string): readonly string[] {
  const tokens = parse(command);
  const scripts: string[] = [];
  for (const token of tokens) {
    if (typeof token !== "string") continue;
    if (!token.endsWith(".sh")) continue;
    if (token.startsWith("~") || token.startsWith("$")) continue;
    scripts.push(token);
  }
  return scripts;
}
