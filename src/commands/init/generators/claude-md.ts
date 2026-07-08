import type { InitOptions, DetectedProject } from "../../../types/index.js";
import {
  SESSION_START_CONTENT, BACKLOG_CONTENT, STOP_AND_SWARM_CONTENT, OFF_LIMITS_CONTENT,
  sprintReviewsContent,
} from "../../../lib/sections.js";

export function generateClaudeMd(options: InitOptions, detected: DetectedProject, env?: { readonly superpowers?: boolean }): string {
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

  // Sprint Reviews — delegates to native /code-review with detected verify commands
  sections.push("", `## Sprint Reviews\n${sprintReviewsContent(detected.testCommand, detected.lintCommand, env?.superpowers ?? false)}`);

  // Conventions
  sections.push("", `## Conventions
- Git: Conventional commits (\`feat:\`, \`fix:\`, \`docs:\`, \`refactor:\`, \`test:\`, \`chore:\`)`);

  // Stop-and-Swarm
  sections.push("", `## Stop-and-Swarm\n${STOP_AND_SWARM_CONTENT}`);

  // Off-Limits
  sections.push("", `## Off-Limits\n${OFF_LIMITS_CONTENT}`);

  // Key Decisions
  sections.push("", `## Key Decisions
<!-- Append one entry per non-obvious choice, at the moment it's made — not at sprint close: -->
<!-- YYYY-MM-DD — Chose X over Y because Z. Revisit if W. -->`);

  return sections.join("\n") + "\n";
}
