import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";
import { isMemoryMcpRegistered } from "../../../lib/memory-registration.js";

export async function analyzePermissions(config: ClaudeConfig, projectRoot: string): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];
  const settings = config.settings;
  const permissions = settings?.permissions as Record<string, unknown> | undefined;
  const denyList = (permissions?.deny as string[] | undefined) ?? [];
  const allowList = (permissions?.allow as string[] | undefined) ?? [];
  const legacyAllowList = (settings?.allowedTools as string[] | undefined) ?? [];

  // Credential file exposure
  const credentialPatterns = ["Read(~/.ssh/*)", "Read(~/.aws/*)", "Read(~/.npmrc)"];
  const missingCreds = credentialPatterns.filter((p) => !denyList.includes(p));
  if (missingCreds.length > 0) {
    issues.push({
      analyzer: "Permissions",
      severity: "high",
      message: `Credential files not blocked: ${missingCreds.join(", ")} — Claude can read SSH keys, AWS creds, or npm tokens`,
      fix: "Add Read(~/.ssh/*), Read(~/.aws/*), Read(~/.npmrc) to permissions.deny",
    });
  }

  // Blanket Bash approval — in permissions.allow or the legacy allowedTools key.
  // Exact match only: "BashOutput" etc. are different tools, and "Bash(...)" is scoped.
  const isBlanketBash = (a: string): boolean => a === "Bash";
  if ([...allowList, ...legacyAllowList].some(isBlanketBash)) {
    issues.push({
      analyzer: "Permissions",
      severity: "high",
      message: "Bash is blanket-allowed without pattern restriction — all shell commands are auto-approved",
      fix: "Replace blanket Bash with scoped patterns like Bash(npm test) or remove it",
    });
  }

  // Bypass mode unprotected
  if (settings?.disableBypassPermissionsMode !== "disable") {
    issues.push({
      analyzer: "Permissions",
      severity: "high",
      message: "Bypass permissions mode not disabled — --dangerously-skip-permissions bypasses all checks",
      fix: 'Add "disableBypassPermissionsMode": "disable" to settings.json',
    });
  }

  // Sandbox is a first-party security feature — never flag it on its own.
  // It isolates Bash subprocesses only, so the memory MCP server is unaffected,
  // but Bash-run memory commands (SessionStart pull / SessionEnd push hooks,
  // `claude-launchpad memory ...`) write ~/.agentic-memory and need a scoped grant.
  const sandbox = settings?.sandbox as Record<string, unknown> | undefined;
  // Covers all three registration scopes, incl. user scope (~/.claude.json)
  // used by local-placement installs that config.mcpServers can't see.
  const memoryInUse = config.mcpServers.some((s) => s.name === "agentic-memory")
    || isMemoryMcpRegistered(projectRoot);
  if (sandbox?.enabled === true && memoryInUse && !sandboxAllowsMemoryWrites(sandbox)) {
    issues.push({
      analyzer: "Permissions",
      severity: "medium",
      message: "Sandbox lacks a write grant for ~/.agentic-memory — Bash-run memory commands (push/pull hooks, CLI) may fail inside the sandbox",
      fix: 'Add "~/.agentic-memory" to sandbox.filesystem.allowWrite — scope the sandbox, don\'t disable it',
    });
  }

  // .env gap: hooks protect but .claudeignore doesn't
  const hasEnvHook = config.hooks.some((h) => h.command?.includes(".env"));
  if (hasEnvHook && config.claudeignoreContent !== null) {
    const lines = config.claudeignoreContent.split("\n").map((l) => l.trim());
    const hasEnvInIgnore = lines.some((l) => l === ".env" || l === ".env.*" || l === ".env*");
    if (!hasEnvInIgnore) {
      issues.push({
        analyzer: "Permissions",
        severity: "medium",
        message: ".env is protected by hooks but not in .claudeignore — cat .env via Bash bypasses hooks",
        fix: "Add .env to .claudeignore for defense in depth",
      });
    }
  }

  // Force-push protection: the hook must actually inspect push+force semantics,
  // not merely contain the substring "force" (e.g. "enforce lint" is not protection)
  const hasForceProtection = config.hooks.some(
    (h) => h.event === "PreToolUse" && !!h.command
      && /push/i.test(h.command) && /--force|-f\b|force/i.test(h.command),
  );
  if (!hasForceProtection) {
    issues.push({
      analyzer: "Permissions",
      severity: "low",
      message: "No force-push protection hook",
      fix: "Add a PreToolUse hook that warns on `git push --force` commands",
    });
  }

  // Guardrails (Off-Limits) intent is checked by the Quality analyzer via
  // intent detection — no duplicate literal-heading check here.

  // Worktree subagents need .worktreeinclude to inherit gitignored env files
  if (config.gitWorktreesActive) {
    const content = config.worktreeIncludeContent;
    const hasEntries = content !== null && content.split("\n").some((l) => {
      const trimmed = l.trim();
      return trimmed.length > 0 && !trimmed.startsWith("#");
    });
    if (!hasEntries) {
      issues.push({
        analyzer: "Permissions",
        severity: "medium",
        message: "Git worktrees in use but .worktreeinclude is missing or empty — subagent worktrees won't inherit gitignored .env files and tests fail silently",
        fix: "Create .worktreeinclude listing files (one per line) to copy into worktrees, e.g. .env.local",
      });
    }
  }

  const score = Math.max(0, 100 - issues.length * 15);
  return { name: "Permissions", issues, score };
}

function sandboxAllowsMemoryWrites(sandbox: Record<string, unknown>): boolean {
  const filesystem = sandbox.filesystem as Record<string, unknown> | undefined;
  const allowWrite = (filesystem?.allowWrite as string[] | undefined) ?? [];
  return allowWrite.some((p) => p.includes(".agentic-memory"));
}
