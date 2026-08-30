import type { InitOptions, DetectedProject } from "../../../types/index.js";
import {
  buildAgentInstructions,
  renderAgentInstructions,
} from "./agent-instructions.js";

export function generateClaudeMd(
  options: InitOptions,
  detected: DetectedProject,
  env?: { readonly superpowers?: boolean },
): string {
  return renderAgentInstructions(
    buildAgentInstructions(options, detected, {
      superpowers: env?.superpowers ?? false,
    }),
  );
}
