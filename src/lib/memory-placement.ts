import { select } from "@inquirer/prompts";
import { readSettingsLocalJson, writeSettingsLocalJson } from "./settings.js";
import type { MemoryPlacement } from "../types/index.js";

export async function getMemoryPlacement(root: string, skipPrompt = false): Promise<MemoryPlacement> {
  const local = await readSettingsLocalJson(root);
  const persisted = local.memoryPlacement;
  if (persisted === "shared" || persisted === "local") {
    return persisted;
  }

  if (skipPrompt) return "shared";

  const choice = await select<MemoryPlacement>({
    message: "Where should memory config go?",
    choices: [
      { value: "shared", name: "Shared (team sees it) — CLAUDE.md + settings.json" },
      { value: "local", name: "Local (only you) — .claude/CLAUDE.md + settings.local.json" },
    ],
  });

  await writeSettingsLocalJson(root, { ...local, memoryPlacement: choice });
  return choice;
}
