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

export interface CursorScaffoldOptions extends InitOptions {
  /** Mirrors init --force: overwrite AGENTS.md only, never other files. */
  readonly force?: boolean;
}

interface PlannedFile {
  readonly relative: string;
  readonly content: string;
  readonly overwrite?: boolean;
}

export async function scaffoldCursor(
  root: string,
  options: CursorScaffoldOptions,
  detected: DetectedProject,
): Promise<ScaffoldResult> {
  const created: string[] = [];
  const preserved: string[] = [];
  for (const file of plannedCursorFiles(options, detected)) {
    const wrote = await writeGeneratedFile(root, file);
    if (wrote) created.push(file.relative);
    else preserved.push(file.relative);
  }
  const scriptResult = await writeCursorHookScripts(root, detected.language);
  created.push(...scriptResult.created);
  preserved.push(...scriptResult.preserved);
  return { created, preserved };
}

function plannedCursorFiles(
  options: CursorScaffoldOptions,
  detected: DetectedProject,
): ReadonlyArray<PlannedFile> {
  return [
    {
      relative: "AGENTS.md",
      content: generateAgentsMd(options, detected),
      overwrite: options.force === true,
    },
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

async function writeGeneratedFile(
  root: string,
  file: PlannedFile,
): Promise<boolean> {
  const path = join(root, file.relative);
  if (!file.overwrite && (await fileExists(path))) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, file.content);
  return true;
}
