import { Command } from "commander";
import { input, confirm, select } from "@inquirer/prompts";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { printBanner, log } from "../../lib/output.js";
import { fileExists } from "../../lib/fs-utils.js";
import { detectProject } from "../../lib/detect.js";
import type { InitOptions, DetectedProject } from "../../types/index.js";
import { generateClaudeMd } from "./generators/claude-md.js";
import { generateTasksMd } from "./generators/tasks-md.js";
import { generateSettings } from "./generators/settings.js";
import { generateClaudeignore } from "./generators/claudeignore.js";
import { generateEnhanceSkill } from "./generators/skill-enhance.js";
import { generateBacklogMd } from "./generators/backlog.js";

export function createInitCommand(): Command {
  return new Command("init")
    .description("Set up Claude Code configuration for any project")
    .option("-n, --name <name>", "Project name")
    .option("-y, --yes", "Accept all defaults")
    .action(async (opts) => {
      printBanner();

      const root = process.cwd();

      // Detect what kind of project this is
      log.step("Detecting project...");
      const detected = await detectProject(root);

      if (detected.language) {
        log.success(`Found ${detected.framework ?? detected.language} project`);
        if (detected.packageManager) log.info(`Package manager: ${detected.packageManager}`);
        if (detected.devCommand) log.info(`Dev command: ${detected.devCommand}`);
        if (detected.testCommand) log.info(`Test command: ${detected.testCommand}`);
      } else {
        log.warn("Could not detect project type — generating minimal config");
      }
      log.blank();

      // Resolve options
      const name = opts.name ?? detected.name ?? await input({
        message: "Project name:",
        validate: (v: string) => (v.trim().length > 0 ? true : "Name cannot be empty"),
      });

      const description = opts.yes ? "" : await input({
        message: "One-line description (optional):",
      });

      const options: InitOptions = { name: name.trim(), description: description.trim() };

      // Check for existing files
      const hasClaudeMd = await fileExists(join(root, "CLAUDE.md"));
      if (hasClaudeMd && !opts.yes) {
        const overwrite = await confirm({
          message: "CLAUDE.md already exists. Overwrite?",
          default: false,
        });
        if (!overwrite) {
          log.info("Keeping existing CLAUDE.md");
          await createEnhanceSkillPrompt(root, false);
          log.step("Tip: run `claude-launchpad doctor` to check your existing config");
          return;
        }
      }

      await scaffold(root, options, detected, opts.yes);
    });
}

async function scaffold(root: string, options: InitOptions, detected: DetectedProject, skipPrompts: boolean): Promise<void> {
  log.step("Generating configuration...");

  const claudeMd = generateClaudeMd(options, detected);
  const tasksMd = generateTasksMd(options);
  const backlogMd = generateBacklogMd(options);
  const settings = generateSettings(detected);
  const claudeignore = generateClaudeignore(detected);

  await mkdir(join(root, ".claude", "rules"), { recursive: true });

  // Merge with existing settings.json instead of overwriting
  const settingsPath = join(root, ".claude", "settings.json");
  const mergedSettings = await mergeSettings(settingsPath, settings as unknown as Record<string, unknown>);

  // Only generate files that don't exist yet
  const backlogPath = join(root, "BACKLOG.md");
  const hasBacklog = await fileExists(backlogPath);
  const claudeignorePath = join(root, ".claudeignore");
  const hasClaudeignore = await fileExists(claudeignorePath);
  const claudeGitignorePath = join(root, ".claude", ".gitignore");
  const hasClaudeGitignore = await fileExists(claudeGitignorePath);
  const rulesPath = join(root, ".claude", "rules", "conventions.md");
  const hasRules = await fileExists(rulesPath);

  const writes: Promise<void>[] = [
    writeFile(join(root, "CLAUDE.md"), claudeMd),
    writeFile(join(root, "TASKS.md"), tasksMd),
    writeFile(settingsPath, JSON.stringify(mergedSettings, null, 2) + "\n"),
  ];

  if (!hasBacklog) {
    writes.push(writeFile(backlogPath, backlogMd));
  }

  if (!hasClaudeignore) {
    writes.push(writeFile(claudeignorePath, claudeignore));
  }

  if (!hasClaudeGitignore) {
    writes.push(writeFile(claudeGitignorePath, [
      "# Local-only Claude Code files (never commit these)",
      "settings.local.json",
      "plans/",
      "memory/",
      "sessions/",
      "tmp/",
      "",
    ].join("\n")));
  }

  if (!hasRules) {
    const rulesContent = generateStarterRules(detected);
    writes.push(writeFile(rulesPath, rulesContent));
  }

  await Promise.all(writes);

  log.success("Generated CLAUDE.md");
  log.success("Generated TASKS.md");
  if (!hasBacklog) log.success("Generated BACKLOG.md");
  log.success("Generated .claude/settings.json (schema, permissions, hooks)");
  if (!hasClaudeGitignore) log.success("Generated .claude/.gitignore");
  if (!hasClaudeignore) log.success("Generated .claudeignore");
  if (!hasRules) log.success("Generated .claude/rules/conventions.md");

  // Offer to create the /lp-enhance skill
  await createEnhanceSkillPrompt(root, skipPrompts);

  log.blank();
  log.success("Done! Run `claude` to start.");
  log.info("Use `/lp-enhance` inside Claude Code to have AI complete your CLAUDE.md.");
  log.info("Run `claude-launchpad doctor` to check your config quality.");
  log.blank();
}

function generateStarterRules(detected: DetectedProject): string {
  const lines = [
    "# Project Conventions",
    "",
    "- Use conventional commits (feat:, fix:, docs:, refactor:, test:, chore:)",
    "- Keep files under 400 lines, functions under 50 lines",
    "- Handle errors explicitly - no empty catch blocks",
    "- Validate input at system boundaries",
  ];

  if (detected.language === "TypeScript" || detected.language === "JavaScript") {
    lines.push("- Use named exports, no default exports except Next.js pages");
    lines.push("- No `any` types in TypeScript");
  }

  if (detected.language === "Python") {
    lines.push("- Type hints on all function signatures");
    lines.push("- Async everywhere for I/O operations");
  }

  if (detected.language === "Go") {
    lines.push("- Table-driven tests");
    lines.push("- Errors are values - handle them, don't ignore them");
  }

  if (detected.language === "Rust") {
    lines.push("- Prefer Result over unwrap/expect in library code");
    lines.push("- No unsafe blocks without a safety comment");
  }

  // Skill authoring conventions
  lines.push(
    "",
    "## Skill Authoring",
    "",
    "When creating Claude Code skills (.claude/skills/*/SKILL.md):",
    "",
    "- Add TRIGGER when / DO NOT TRIGGER when clauses in the description for auto-invocation",
    "- Add allowed-tools in frontmatter to restrict tool access (e.g. Read, Glob, Grep for read-only skills)",
    "- Add argument-hint in frontmatter showing the expected input format",
    "- Structure as phases: Research, Plan, Execute, Verify with \"Done when:\" success criteria per phase",
    "- Handle edge cases and preconditions before execution",
  );

  lines.push("");
  return lines.join("\n");
}


async function createEnhanceSkillPrompt(root: string, skipPrompts: boolean): Promise<void> {
  const projectPath = join(root, ".claude", "skills", "lp-enhance", "SKILL.md");
  const globalPath = join(homedir(), ".claude", "skills", "lp-enhance", "SKILL.md");
  // Also check legacy commands/ location
  const legacyProject = join(root, ".claude", "commands", "lp-enhance.md");
  const legacyGlobal = join(homedir(), ".claude", "commands", "lp-enhance.md");

  if (await fileExists(projectPath) || await fileExists(globalPath)
    || await fileExists(legacyProject) || await fileExists(legacyGlobal)) return;

  const scope = skipPrompts ? "project" : await select({
    message: "Install /lp-enhance skill (AI-powered CLAUDE.md improver):",
    choices: [
      { value: "project", name: "Project scope (.claude/skills/)" },
      { value: "global", name: "Global scope (~/.claude/skills/)" },
      { value: "skip", name: "Skip" },
    ],
  });

  if (scope === "skip") return;

  const targetDir = scope === "global"
    ? join(homedir(), ".claude", "skills", "lp-enhance")
    : join(root, ".claude", "skills", "lp-enhance");

  await mkdir(targetDir, { recursive: true });
  await writeFile(join(targetDir, "SKILL.md"), generateEnhanceSkill());
  log.success(`Generated /lp-enhance skill (${scope} scope)`);
}

async function mergeSettings(
  existingPath: string,
  generated: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    const existing = JSON.parse(await readFile(existingPath, "utf-8")) as Record<string, unknown>;

    // Merge hooks: keep existing hooks, add generated ones that don't conflict
    const existingHooks = (existing.hooks ?? {}) as Record<string, unknown[]>;
    const generatedHooks = (generated.hooks ?? {}) as Record<string, unknown[]>;

    const mergedHooks: Record<string, unknown[]> = { ...existingHooks };
    for (const [event, hookList] of Object.entries(generatedHooks)) {
      if (!mergedHooks[event]) {
        mergedHooks[event] = hookList;
      }
      // If event already exists, keep existing (don't duplicate)
    }

    return {
      ...existing,
      ...generated,
      hooks: Object.keys(mergedHooks).length > 0 ? mergedHooks : undefined,
    };
  } catch {
    // No existing file — just use generated
    return generated;
  }
}
