import { Command } from "commander";
import { input, confirm } from "@inquirer/prompts";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { printBanner, log } from "../../lib/output.js";
import { detectProject } from "../../lib/detect.js";
import type { InitOptions, DetectedProject } from "../../types/index.js";
import { generateClaudeMd } from "./generators/claude-md.js";
import { generateTasksMd } from "./generators/tasks-md.js";
import { generateSettings } from "./generators/settings.js";

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

  await mkdir(join(root, ".claude"), { recursive: true });

  const writes: Promise<void>[] = [
    writeFile(join(root, "CLAUDE.md"), claudeMd),
    writeFile(join(root, "TASKS.md"), tasksMd),
    writeFile(join(root, ".claude", "settings.json"), JSON.stringify(settings, null, 2) + "\n"),
  ];

  await Promise.all(writes);

  log.success("Generated CLAUDE.md");
  log.success("Generated TASKS.md");
  log.success("Generated .claude/settings.json (with hooks)");

  log.blank();
  log.success("Done! Run `claude` to start.");
  log.info("Run `claude-launchpad doctor` to check your config quality.");
  log.blank();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
