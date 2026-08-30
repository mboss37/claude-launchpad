import type { HarnessProfile } from "../types.js";
import { parseCursorConfig } from "./parser.js";
import type { CursorConfig } from "./types.js";

export const cursorHarnessProfile: HarnessProfile<CursorConfig> = {
  id: "cursor",
  displayName: "Cursor Agent",
  async detect(root) {
    const config = await parseCursorConfig(root);
    return (
      config.instructionsContent !== null ||
      config.hooksPath !== null ||
      config.rules.length > 0
    );
  },
  parse: parseCursorConfig,
};
