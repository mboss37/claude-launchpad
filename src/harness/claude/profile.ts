import { access } from "node:fs/promises";
import { join } from "node:path";
import { parseClaudeConfig } from "../../lib/parser.js";
import type { ClaudeConfig } from "../../types/index.js";
import type { HarnessProfile } from "../types.js";

export const claudeHarnessProfile: HarnessProfile<ClaudeConfig> = {
  id: "claude",
  displayName: "Claude Code",
  async detect(root) {
    return existsAny(
      join(root, "CLAUDE.md"),
      join(root, ".claude", "settings.json"),
    );
  },
  parse: parseClaudeConfig,
};

async function existsAny(...paths: ReadonlyArray<string>): Promise<boolean> {
  const checks = await Promise.all(
    paths.map((path) =>
      access(path)
        .then(() => true)
        .catch(() => false),
    ),
  );
  return checks.some(Boolean);
}
