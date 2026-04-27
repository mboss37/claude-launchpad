import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";

export async function analyzePermissions(config: ClaudeConfig): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];
  const settings = config.settings;
  const permissions = settings?.permissions as Record<string, unknown> | undefined;
  const denyList = (permissions?.deny as string[] | undefined) ?? [];
  const allowList = (permissions?.allow as string[] | undefined) ?? [];

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

  // Blanket Bash approval
  const hasBlanketBash = allowList.some((a) => a === "Bash" || (a.startsWith("Bash") && !a.includes("(")));
  if (hasBlanketBash) {
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

  // Filesystem sandbox actively breaks cross-project tooling (memory MCP, ~/.claude reads)
  const sandbox = settings?.sandbox as Record<string, unknown> | undefined;
  if (sandbox?.enabled === true) {
    issues.push({
      analyzer: "Permissions",
      severity: "high",
      message: "Filesystem sandbox enabled — blocks memory MCP and other cross-project tooling. Deny rules already cover the threat model.",
      fix: 'Remove the "sandbox" block from settings.json',
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

  // Bash auto-allow without security hooks (existing check)
  const hasBashSecurity = config.hooks.some(
    (h) => h.event === "PreToolUse" && (h.matcher?.includes("Bash") || !h.matcher),
  );
  const bashAllowed = settings?.allowedTools as string[] | undefined;
  const hasBashAutoAllow = bashAllowed?.some((t) =>
    typeof t === "string" && t.toLowerCase().includes("bash"),
  );
  if (hasBashAutoAllow && !hasBashSecurity) {
    issues.push({
      analyzer: "Permissions",
      severity: "high",
      message: "Bash is auto-allowed without a security hook — dangerous commands could run unchecked",
      fix: "Add a PreToolUse hook for Bash that blocks destructive commands",
    });
  }

  // Force-push protection
  const hasForceProtection = config.hooks.some(
    (h) => h.event === "PreToolUse" && h.command?.includes("force"),
  );
  if (!hasForceProtection) {
    issues.push({
      analyzer: "Permissions",
      severity: "low",
      message: "No force-push protection hook",
      fix: "Add a PreToolUse hook that warns on `git push --force` commands",
    });
  }

  // Off-Limits section in CLAUDE.md
  if (config.claudeMdContent) {
    const hasOffLimits = config.claudeMdContent.includes("## Off-Limits") ||
      config.claudeMdContent.includes("## off-limits");
    if (!hasOffLimits) {
      issues.push({
        analyzer: "Permissions",
        severity: "medium",
        message: "No Off-Limits section in CLAUDE.md — Claude has no guardrails beyond defaults",
        fix: "Add an ## Off-Limits section with project-specific restrictions",
      });
    }
  }

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
