import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { generateBacklogMd } from "../../commands/init/generators/backlog.js";
import { generateTasksMd } from "../../commands/init/generators/tasks-md.js";
import { fileExists } from "../../lib/fs-utils.js";
import type { DetectedProject, InitOptions } from "../../types/index.js";
import {
  generateAgentsMd,
  generateCursorConventionsRule,
  generateCursorEnhanceSkill,
  generateCursorHooks,
  generateCursorHooksRule,
  generateCursorIgnore,
  generateCursorReviewer,
  generateCursorVerificationRule,
  generateCursorWorkflowRule,
} from "./generators.js";
import { writeCursorHookScripts } from "./hook-scripts.js";

export interface ScaffoldResult {
  readonly created: ReadonlyArray<string>;
  readonly preserved: ReadonlyArray<string>;
}

interface PlannedFile {
  readonly relative: string;
  readonly content: string;
}

export async function scaffoldCursor(
  root: string,
  options: InitOptions,
  detected: DetectedProject,
): Promise<ScaffoldResult> {
  const created: string[] = [];
  const preserved: string[] = [];
  for (const file of plannedCursorFiles(options, detected)) {
    const wrote = await writeNewFile(root, file.relative, file.content);
    if (wrote) created.push(file.relative);
    else preserved.push(file.relative);
  }
  const scriptResult = await writeNewHookScripts(root, detected.language);
  created.push(...scriptResult.created);
  preserved.push(...scriptResult.preserved);
  return { created, preserved };
}

function plannedCursorFiles(
  options: InitOptions,
  detected: DetectedProject,
): ReadonlyArray<PlannedFile> {
  return [
    { relative: "AGENTS.md", content: generateAgentsMd(options, detected) },
    { relative: "TASKS.md", content: generateTasksMd(options) },
    { relative: "BACKLOG.md", content: generateBacklogMd(options) },
    {
      relative: ".cursor/hooks.json",
      content: `${JSON.stringify(generateCursorHooks(detected), null, 2)}\n`,
    },
    { relative: ".cursorignore", content: generateCursorIgnore(detected) },
    {
      relative: ".cursor/rules/conventions.mdc",
      content: generateCursorConventionsRule(detected),
    },
    {
      relative: ".cursor/rules/workflow.mdc",
      content: generateCursorWorkflowRule(),
    },
    { relative: ".cursor/rules/hooks.mdc", content: generateCursorHooksRule() },
    {
      relative: ".cursor/rules/verification.mdc",
      content: generateCursorVerificationRule(),
    },
    {
      relative: ".cursor/agents/code-reviewer.md",
      content: generateCursorReviewer(),
    },
    {
      relative: ".cursor/skills/lp-enhance/SKILL.md",
      content: generateCursorEnhanceSkill(),
    },
  ];
}

async function writeNewFile(
  root: string,
  relative: string,
  content: string,
): Promise<boolean> {
  const path = join(root, relative);
  if (await fileExists(path)) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  return true;
}

async function writeNewHookScripts(
  root: string,
  language: string | null,
): Promise<ScaffoldResult> {
  const envPath = join(root, ".cursor", "hooks", "env-read.sh");
  if (await fileExists(envPath)) {
    return {
      created: [],
      preserved: [
        ".cursor/hooks/env-read.sh",
        ".cursor/hooks/destructive-shell.sh",
        ".cursor/hooks/auto-format.sh",
        ".cursor/hooks/workflow-check.sh",
        ".cursor/hooks/sprint-open.sh",
        ".cursor/hooks/session-context.sh",
        ".cursor/hooks/sprint-size.sh",
      ],
    };
  }
  return {
    created: await writeCursorHookScripts(root, language),
    preserved: [],
  };
}
