import { access } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessId, HarnessSelection } from "./types.js";

const VALID = new Set<HarnessSelection>(["auto", "claude", "cursor", "both"]);

export function parseHarnessSelection(value: string): HarnessSelection {
  if (VALID.has(value as HarnessSelection)) return value as HarnessSelection;
  throw new Error("Harness must be one of: auto, claude, cursor, both");
}

export async function detectHarnesses(
  root: string,
): Promise<ReadonlyArray<HarnessId>> {
  const [claude, cursor] = await Promise.all([
    exists(join(root, "CLAUDE.md"), join(root, ".claude", "settings.json")),
    exists(join(root, "AGENTS.md"), join(root, ".cursor")),
  ]);
  return [
    ...(claude ? ["claude" as const] : []),
    ...(cursor ? ["cursor" as const] : []),
  ];
}

export function resolveHarnesses(
  selection: HarnessSelection,
  detected: ReadonlyArray<HarnessId>,
): ReadonlyArray<HarnessId> {
  if (selection === "both") return ["claude", "cursor"];
  if (selection === "auto") return [...detected];
  return [selection];
}

async function exists(...paths: ReadonlyArray<string>): Promise<boolean> {
  const checks = await Promise.all(
    paths.map((path) =>
      access(path)
        .then(() => true)
        .catch(() => false),
    ),
  );
  return checks.some(Boolean);
}
