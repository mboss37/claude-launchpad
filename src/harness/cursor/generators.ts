import { generateClaudeignore } from "../../commands/init/generators/claudeignore.js";
import {
  buildAgentInstructions,
  renderAgentInstructions,
} from "../../commands/init/generators/agent-instructions.js";
import { generateReviewerAgent } from "../../commands/init/generators/agent-reviewer.js";
import { generateWorkflowRule } from "../../commands/init/generators/workflow-rule.js";
import { generateHooksRule } from "../../commands/init/generators/hooks-rule.js";
import { generateVerificationRule } from "../../commands/init/generators/verification-rule.js";
import { TESTING_DISCIPLINE_CONTENT } from "../../lib/sections.js";
import type { DetectedProject, InitOptions } from "../../types/index.js";

export const CURSOR_WORKFLOW_RULE_VERSION = 1;
export const CURSOR_HOOKS_RULE_VERSION = 1;
export const CURSOR_VERIFICATION_RULE_VERSION = 1;
export const CURSOR_CONVENTIONS_RULE_VERSION = 1;

export interface CursorRuleOptions {
  readonly description: string;
  readonly globs?: string;
  readonly alwaysApply: boolean;
  readonly body: string;
  readonly marker: string;
}

export interface CursorGeneratedHook {
  readonly command: string;
  readonly failClosed?: boolean;
}

export interface CursorHooksDocument {
  readonly version: 1;
  readonly hooks: {
    readonly beforeReadFile?: ReadonlyArray<CursorGeneratedHook>;
    readonly beforeShellExecution?: ReadonlyArray<CursorGeneratedHook>;
    readonly afterFileEdit?: ReadonlyArray<CursorGeneratedHook>;
    readonly afterShellExecution?: ReadonlyArray<CursorGeneratedHook>;
    readonly sessionStart?: ReadonlyArray<CursorGeneratedHook>;
  };
}

const FORMATTABLE = new Set([
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Ruby",
  "Dart",
  "PHP",
  "Kotlin",
  "Java",
  "Swift",
  "Elixir",
  "C#",
]);

export function generateCursorRule(options: CursorRuleOptions): string {
  const frontmatter = [
    "---",
    `description: ${options.description}`,
    ...(options.globs ? [`globs: ${options.globs}`] : []),
    `alwaysApply: ${options.alwaysApply}`,
    "---",
  ];
  return `${frontmatter.join("\n")}\n\n<!-- ${options.marker} -->\n${options.body}\n`;
}

export function generateCursorHooks(
  detected: DetectedProject,
): CursorHooksDocument {
  const afterFileEdit = [
    ...(detected.language && FORMATTABLE.has(detected.language)
      ? [{ command: ".cursor/hooks/auto-format.sh" }]
      : []),
    { command: ".cursor/hooks/workflow-check.sh" },
  ];
  return {
    version: 1,
    hooks: {
      beforeReadFile: [
        { command: ".cursor/hooks/env-read.sh", failClosed: true },
      ],
      beforeShellExecution: [
        { command: ".cursor/hooks/destructive-shell.sh", failClosed: true },
      ],
      afterFileEdit,
      afterShellExecution: [{ command: ".cursor/hooks/sprint-open.sh" }],
      sessionStart: [
        { command: ".cursor/hooks/session-context.sh" },
        { command: ".cursor/hooks/sprint-size.sh" },
      ],
    },
  };
}

export function generateCursorIgnore(detected: DetectedProject): string {
  return generateClaudeignore(detected);
}

export function generateAgentsMd(
  options: InitOptions,
  detected: DetectedProject,
  features: { readonly superpowers: boolean } = { superpowers: false },
): string {
  return renderAgentInstructions(
    buildAgentInstructions(options, detected, features),
  );
}

export function generateCursorReviewer(): string {
  return generateReviewerAgent()
    .replaceAll("CLAUDE.md", "AGENTS.md")
    .replaceAll(".claude/rules/", ".cursor/rules/");
}

export { generateCursorEnhanceSkill } from "./skill-enhance.js";

export function generateCursorWorkflowRule(): string {
  return generateCursorRule({
    description: "Workflow rules",
    globs: "{BACKLOG.md,TASKS.md}",
    alwaysApply: false,
    body: stripClaudeRuleChrome(generateWorkflowRule()),
    marker: `lp-cursor-workflow-version: ${CURSOR_WORKFLOW_RULE_VERSION}`,
  });
}

export function generateCursorHooksRule(): string {
  return generateCursorRule({
    description: "Hook authoring rules",
    globs: "{.cursor/hooks.json,.cursor/hooks/**}",
    alwaysApply: false,
    body: stripClaudeRuleChrome(generateHooksRule()),
    marker: `lp-cursor-hooks-version: ${CURSOR_HOOKS_RULE_VERSION}`,
  });
}

export function generateCursorVerificationRule(): string {
  return generateCursorRule({
    description: "Evidence-before-assertion discipline",
    alwaysApply: true,
    body: stripClaudeRuleChrome(generateVerificationRule()),
    marker: `lp-cursor-verification-version: ${CURSOR_VERIFICATION_RULE_VERSION}`,
  });
}

export function generateCursorConventionsRule(
  detected: DetectedProject,
): string {
  return generateCursorRule({
    description: "Project conventions",
    alwaysApply: true,
    body: conventionsBody(detected),
    marker: `lp-cursor-conventions-version: ${CURSOR_CONVENTIONS_RULE_VERSION}`,
  });
}

function stripClaudeRuleChrome(content: string): string {
  const withoutFrontmatter = stripFrontmatter(content);
  return withoutFrontmatter
    .replace(/<!-- lp-[a-z-]+-version: \d+ -->\n*/g, "")
    .replace(/^\n+/, "");
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return content;
  return content.slice(end + 5);
}

function conventionsBody(detected: DetectedProject): string {
  const languageLines = languageConventions(detected.language);
  const verify = [detected.testCommand, detected.lintCommand]
    .filter((command): command is string => !!command)
    .map((command) => `\`${command}\``)
    .join(" && ");
  return [
    "# Project Conventions",
    "",
    "- Use conventional commits (feat:, fix:, docs:, refactor:, test:, chore:)",
    "- Keep files under 400 lines, functions under 50 lines",
    "- Handle errors explicitly - no empty catch blocks",
    "- Validate input at system boundaries",
    ...languageLines,
    "",
    "## Testing Discipline",
    "",
    TESTING_DISCIPLINE_CONTENT,
    "",
    "## Pre-Commit Checklist",
    "",
    verify
      ? `1. Run ${verify} — never commit if either fails`
      : "1. Run the project's test and typecheck commands — never commit if either fails",
    "2. For hard-TDD surfaces, confirm the test was written before the implementation",
  ].join("\n");
}

function languageConventions(language: string | null): ReadonlyArray<string> {
  if (language === "TypeScript" || language === "JavaScript") {
    return [
      "- Use named exports, no default exports except Next.js pages",
      "- No `any` types in TypeScript",
    ];
  }
  if (language === "Python") {
    return [
      "- Type hints on all function signatures",
      "- Async everywhere for I/O operations",
    ];
  }
  if (language === "Go") {
    return [
      "- Table-driven tests",
      "- Errors are values - handle them, don't ignore them",
    ];
  }
  if (language === "Rust") {
    return [
      "- Prefer Result over unwrap/expect in library code",
      "- No unsafe blocks without a safety comment",
    ];
  }
  return [];
}
