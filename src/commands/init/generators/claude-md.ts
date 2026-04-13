import type { InitOptions, DetectedProject } from "../../../types/index.js";

export function generateClaudeMd(options: InitOptions, detected: DetectedProject): string {
  const sections: string[] = [];

  // Header
  sections.push(`# ${options.name}`);
  if (options.description) {
    sections.push("", options.description);
  }

  // Stack (auto-detected)
  sections.push("", "## Stack");
  if (detected.language) {
    const items: string[] = [];
    if (detected.framework) items.push(`- **Framework**: ${detected.framework}`);
    items.push(`- **Language**: ${detected.language}`);
    if (detected.packageManager) items.push(`- **Package Manager**: ${detected.packageManager}`);
    sections.push(items.join("\n"));
  } else {
    sections.push("<!-- TODO: Define your tech stack -->");
  }

  // Commands (auto-detected)
  sections.push("", "## Commands");
  const commands: string[] = [];
  if (detected.devCommand) commands.push(`- Dev: \`${detected.devCommand}\``);
  if (detected.buildCommand) commands.push(`- Build: \`${detected.buildCommand}\``);
  if (detected.testCommand) commands.push(`- Test: \`${detected.testCommand}\``);
  if (detected.lintCommand) commands.push(`- Lint: \`${detected.lintCommand}\``);
  if (detected.formatCommand) commands.push(`- Format: \`${detected.formatCommand}\``);
  if (commands.length > 0) {
    sections.push(commands.join("\n"));
  } else {
    sections.push("<!-- TODO: Add your dev/build/test commands -->");
  }

  // Session Start
  sections.push("", `## Session Start
- ALWAYS read @TASKS.md first — it tracks progress across sessions
- Check the Session Log at the bottom of TASKS.md for where we left off
- Update TASKS.md as you complete work

## Backlog
- When a feature is discussed but deferred, add it to BACKLOG.md immediately
- Never leave future ideas only in TASKS.md or conversation — they get lost
- BACKLOG.md is the single source of truth for parked features`);

  // Sprint Reviews
  sections.push("", `## Sprint Reviews
When all tasks in the current sprint are complete, do a quick quality check before committing:
- Scan changed files for dead code, debug logs, and TODO hacks
- Run tests and type-checker if available
- Check for convention violations and hardcoded values
- Fix any issues, then commit
- Skip if the sprint was trivial (docs, config-only changes)`);

  // Conventions
  sections.push("", `## Conventions
- Git: Conventional commits (\`feat:\`, \`fix:\`, \`docs:\`, \`refactor:\`, \`test:\`, \`chore:\`)`);

  // Stop-and-Swarm
  sections.push("", `## Stop-and-Swarm
Three failed iterations on the same problem = stop iterating alone.
On the fourth attempt, spin up at least 3 parallel agents via the Agent tool, each investigating from a different angle:
1. Root-cause debug agent
2. Upstream library/docs research agent
3. Alternative architecture agent
Wait for all agents to return, synthesize their findings, then act.
Don't keep guessing in circles — rotate perspectives.`);

  // Off-Limits
  sections.push("", `## Off-Limits
- Never hardcode secrets — use environment variables
- Never write to \`.env\` files
- Never expose internal error details in API responses`);

  // Key Decisions
  sections.push("", `## Key Decisions
<!-- Record architectural decisions as you make them -->`);

  return sections.join("\n") + "\n";
}
