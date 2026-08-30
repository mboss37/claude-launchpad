import type { AnalyzerResult } from "../../types/index.js";
import { analyzeCursorHooks } from "./analyzers/hooks.js";
import { analyzeCursorInstructions } from "./analyzers/instructions.js";
import { analyzeCursorMcp } from "./analyzers/mcp.js";
import { analyzeCursorRules } from "./analyzers/rules.js";
import { analyzeCursorSecurity } from "./analyzers/security.js";
import type { CursorConfig } from "./types.js";

export async function runCursorAnalyzers(
  config: CursorConfig,
  root: string,
): Promise<ReadonlyArray<AnalyzerResult>> {
  return Promise.all([
    analyzeCursorInstructions(config),
    analyzeCursorHooks(config, root),
    analyzeCursorRules(config, root),
    analyzeCursorSecurity(config),
    analyzeCursorMcp(config),
  ]);
}
