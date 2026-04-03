import { Command } from "commander";
import { join } from "node:path";
import { createInitCommand } from "./commands/init/index.js";
import { createDoctorCommand } from "./commands/doctor/index.js";
import { createEvalCommand } from "./commands/eval/index.js";
import { createMemoryCommand } from "./commands/memory/index.js";
import { printBanner, log } from "./lib/output.js";
import { fileExists } from "./lib/fs-utils.js";

const program = new Command()
  .name("claude-launchpad")
  .description("CLI toolkit that makes Claude Code setups measurably good")
  .version("0.8.0", "-v, --version")
  .action(async () => {
    // Default behavior: detect existing config and route accordingly
    const hasConfig = await fileExists(join(process.cwd(), "CLAUDE.md"))
      || await fileExists(join(process.cwd(), ".claude", "settings.json"));

    if (hasConfig) {
      // Route directly to doctor — it prints its own banner
      await program.commands.find((c) => c.name() === "doctor")?.parseAsync([], { from: "user" });
    } else {
      printBanner();
      log.info("No Claude Code config found in this directory.");
      log.blank();
      log.step("Run `claude-launchpad init` to set up your project");
      log.step("Run `claude-launchpad doctor` to diagnose an existing config");
      log.step("Use `/lp-enhance` skill inside Claude Code to AI-complete your CLAUDE.md");
      log.step("Run `claude-launchpad eval` to test your config quality");
      log.blank();
    }
  });

program.addCommand(createInitCommand());
program.addCommand(createDoctorCommand());
program.addCommand(createEvalCommand());
program.addCommand(createMemoryCommand());

program.parse();
