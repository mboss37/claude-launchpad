import { select } from "@inquirer/prompts";
import { readSettingsJson, readSettingsLocalJson, writeSettingsLocalJson } from "./settings.js";
import type { MemoryPlacement } from "../types/index.js";

function hasMemoryPermissions(settings: Record<string, unknown>): boolean {
  const permissions = settings.permissions as Record<string, unknown> | undefined;
  const allow = (permissions?.allow as string[] | undefined) ?? [];
  return allow.some((p) => p.includes("agentic-memory"));
}

export async function getMemoryPlacement(root: string, skipPrompt = false): Promise<MemoryPlacement> {
  const local = await readSettingsLocalJson(root);
  const persisted = local.memoryPlacement;
  if (persisted === "shared" || persisted === "local") {
    return persisted;
  }

  // Backfill: infer from where agentic-memory permissions already live
  if (hasMemoryPermissions(local)) {
    await writeSettingsLocalJson(root, { ...local, memoryPlacement: "local" });
    return "local";
  }
  const shared = await readSettingsJson(root);
  if (hasMemoryPermissions(shared)) {
    await writeSettingsLocalJson(root, { ...local, memoryPlacement: "shared" });
    return "shared";
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
