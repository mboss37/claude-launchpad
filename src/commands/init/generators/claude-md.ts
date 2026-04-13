import type { InitOptions, DetectedProject } from "../../../types/index.js";
import {
  SESSION_START_CONTENT, BACKLOG_CONTENT, STOP_AND_SWARM_CONTENT, OFF_LIMITS_CONTENT,
} from "../../../lib/sections.js";

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
  sections.push("", `## Session Start\n${SESSION_START_CONTENT}`);

  // Backlog
  sections.push("", `## Backlog\n${BACKLOG_CONTENT}`);

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
  sections.push("", `## Stop-and-Swarm\n${STOP_AND_SWARM_CONTENT}`);

  // Off-Limits
  sections.push("", `## Off-Limits\n${OFF_LIMITS_CONTENT}`);

  // Key Decisions
  sections.push("", `## Key Decisions
<!-- Record architectural decisions as you make them -->`);

  return sections.join("\n") + "\n";
}
