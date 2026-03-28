import { Command } from "commander";
import { input, confirm } from "@inquirer/prompts";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { printBanner, log } from "../../lib/output.js";
import { fileExists } from "../../lib/fs-utils.js";
import { detectProject } from "../../lib/detect.js";
import type { InitOptions, DetectedProject } from "../../types/index.js";
import { generateClaudeMd } from "./generators/claude-md.js";
import { generateTasksMd } from "./generators/tasks-md.js";
import { generateSettings } from "./generators/settings.js";
import { generateClaudeignore } from "./generators/claudeignore.js";

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
          log.step("Tip: run `claude-launchpad doctor` to check your existing config");
          return;
        }
      }

      await scaffold(root, options, detected);
    });
}

async function scaffold(root: string, options: InitOptions, detected: DetectedProject): Promise<void> {
  log.step("Generating configuration...");

  const claudeMd = generateClaudeMd(options, detected);
  const tasksMd = generateTasksMd(options);
  const settings = generateSettings(detected);
  const claudeignore = generateClaudeignore(detected);

  await mkdir(join(root, ".claude"), { recursive: true });

  // Merge with existing settings.json instead of overwriting
  const settingsPath = join(root, ".claude", "settings.json");
  const mergedSettings = await mergeSettings(settingsPath, settings as unknown as Record<string, unknown>);

  // Only generate .claudeignore if it doesn't exist
  const claudeignorePath = join(root, ".claudeignore");
  const hasClaudeignore = await fileExists(claudeignorePath);

  const writes: Promise<void>[] = [
    writeFile(join(root, "CLAUDE.md"), claudeMd),
    writeFile(join(root, "TASKS.md"), tasksMd),
    writeFile(settingsPath, JSON.stringify(mergedSettings, null, 2) + "\n"),
  ];

  if (!hasClaudeignore) {
    writes.push(writeFile(claudeignorePath, claudeignore));
  }

  await Promise.all(writes);

  log.success("Generated CLAUDE.md");
  log.success("Generated TASKS.md");
  log.success("Generated .claude/settings.json (merged with existing)");
  if (!hasClaudeignore) {
    log.success("Generated .claudeignore");
  }

  log.blank();
  log.success("Done! Run `claude` to start.");
  log.info("Run `claude-launchpad doctor` to check your config quality.");
  log.blank();
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
