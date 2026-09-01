import { claudeHarnessProfile } from "./claude/profile.js";
import { cursorHarnessProfile } from "./cursor/profile.js";
import type { HarnessId, HarnessSelection } from "./types.js";

const VALID = new Set<HarnessSelection>(["auto", "claude", "cursor", "both"]);

export const HARNESS_PROFILES = {
  claude: claudeHarnessProfile,
  cursor: cursorHarnessProfile,
} as const;

export function parseHarnessSelection(value: string): HarnessSelection {
  if (VALID.has(value as HarnessSelection)) return value as HarnessSelection;
  throw new Error("Harness must be one of: auto, claude, cursor, both");
}

export async function detectHarnesses(
  root: string,
): Promise<ReadonlyArray<HarnessId>> {
  const ids = Object.keys(HARNESS_PROFILES) as Array<
    keyof typeof HARNESS_PROFILES
  >;
  const flags = await Promise.all(
    ids.map((id) => HARNESS_PROFILES[id].detect(root)),
  );
  return ids.filter((_, index) => flags[index]);
}

export function resolveHarnesses(
  selection: HarnessSelection,
  detected: ReadonlyArray<HarnessId>,
): ReadonlyArray<HarnessId> {
  if (selection === "both") return ["claude", "cursor"];
  if (selection === "auto") return [...detected];
  return [selection];
}
