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
- Update TASKS.md as you complete work`);

  // Conventions
  sections.push("", `## Conventions
- Git: Conventional commits (\`feat:\`, \`fix:\`, \`docs:\`, \`refactor:\`, \`test:\`, \`chore:\`)`);

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
