import type { HarnessId } from "../../harness/types.js";

export type MemoryInstallHarness = HarnessId | "both";

export function parseMemoryInstallHarness(value: string): MemoryInstallHarness {
  if (value === "claude" || value === "cursor" || value === "both")
    return value;
  throw new Error("Memory --harness must be claude, cursor, or both");
}

export function resolveMemoryInstallTargets(options: {
  readonly detected: ReadonlyArray<HarnessId>;
  readonly explicit?: MemoryInstallHarness;
  readonly allDetectedWhenUnspecified: boolean;
  readonly selected?: ReadonlyArray<HarnessId>;
}): ReadonlyArray<HarnessId> {
  if (options.detected.length === 0) {
    throw new Error(
      "No agent harness detected. Run `claude-launchpad init` first.",
    );
  }
  if (options.explicit)
    return explicitTargets(options.detected, options.explicit);
  if (options.allDetectedWhenUnspecified) return [...options.detected];
  return selectedTargets(options.detected, options.selected);
}

function explicitTargets(
  detected: ReadonlyArray<HarnessId>,
  explicit: MemoryInstallHarness,
): ReadonlyArray<HarnessId> {
  const wanted: ReadonlyArray<HarnessId> =
    explicit === "both" ? ["claude", "cursor"] : [explicit];
  return requireInstalled(detected, wanted);
}

function selectedTargets(
  detected: ReadonlyArray<HarnessId>,
  selected: ReadonlyArray<HarnessId> | undefined,
): ReadonlyArray<HarnessId> {
  if (selected === undefined || selected.length === 0) {
    throw new Error("Select at least one harness to install memory into.");
  }
  return requireInstalled(detected, selected);
}

function requireInstalled(
  detected: ReadonlyArray<HarnessId>,
  wanted: ReadonlyArray<HarnessId>,
): ReadonlyArray<HarnessId> {
  const missing = wanted.find((id) => !detected.includes(id));
  if (missing) {
    throw new Error(`Harness ${missing} is not installed in this project.`);
  }
  return [...wanted];
}
