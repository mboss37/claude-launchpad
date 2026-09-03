import { Command } from "commander";
import { createInitCommand } from "./commands/init/index.js";
import { createDoctorCommand } from "./commands/doctor/index.js";
import { createEvalCommand } from "./commands/eval/index.js";
import { createMemoryCommand } from "./commands/memory/index.js";
import { printBanner, log } from "./lib/output.js";
import { detectHarnesses } from "./harness/registry.js";

const program = new Command()
  .name("claude-launchpad")
  .description(
    "Score your coding agent config, fix the gaps, prove the agent follows your rules.",
  )
  .version("1.18.0", "-v, --version")
  .action(async () => {
    const detected = await detectHarnesses(process.cwd());

    if (detected.length > 0) {
      await program.commands
        .find((c) => c.name() === "doctor")
        ?.parseAsync([], { from: "user" });
    } else {
      printBanner();
      log.info("No coding agent config found in this directory.");
      log.blank();
      log.step("New project:      `claude-launchpad init`");
      log.step("Existing config:  `claude-launchpad doctor`");
      log.blank();
    }
  });

program.addCommand(createInitCommand());
program.addCommand(createDoctorCommand());
program.addCommand(createEvalCommand());
program.addCommand(createMemoryCommand());

program.parse();
