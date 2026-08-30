import { access } from "node:fs/promises";
import { join } from "node:path";
import { parseClaudeConfig } from "../../lib/parser.js";
import type { ClaudeConfig } from "../../types/index.js";
import type { HarnessProfile } from "../types.js";

export const claudeHarnessProfile: HarnessProfile<ClaudeConfig> = {
  id: "claude",
  displayName: "Claude Code",
  async detect(root) {
    return access(join(root, "CLAUDE.md"))
      .then(() => true)
      .catch(() => false);
  },
  parse: parseClaudeConfig,
};
