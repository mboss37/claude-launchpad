import type { AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";
import {
  documentSatisfiesIntent,
  INTENT_RULES,
  parseSections,
} from "../../../commands/doctor/analyzers/quality-intents.js";
import type { CursorConfig } from "../types.js";
import { scoreIssues } from "./score.js";

export async function analyzeCursorInstructions(
  config: CursorConfig,
): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];
  const content = config.instructionsContent;
  if (content === null) {
    issues.push({
      analyzer: "Instructions",
      severity: "high",
      message: "No AGENTS.md found",
      fix: "Run `claude-launchpad init --harness cursor` to generate one",
    });
    return { name: "Instructions", issues, score: 0 };
  }

  if (config.instructionCount > 250) {
    issues.push({
      analyzer: "Instructions",
      severity: "critical",
      message: `${config.instructionCount} instructions — way over the ~200 budget`,
      fix: "Move detailed rules to .cursor/rules/*.mdc",
    });
  } else if (config.instructionCount > 200) {
    issues.push({
      analyzer: "Instructions",
      severity: "high",
      message: `${config.instructionCount} instructions exceed the 200-line budget`,
      fix: "Move detailed rules to .cursor/rules/*.mdc",
    });
  }

  const sections = parseSections(content);
  const rules = INTENT_RULES.filter(
    (rule) => rule.name !== "Architecture/Structure",
  );
  for (const rule of rules) {
    if (!documentSatisfiesIntent(sections, rule)) {
      issues.push({
        analyzer: "Instructions",
        severity: "medium",
        message: `Missing "## ${rule.name}" section — ${rule.why}`,
        fix: `Add a ## ${rule.name} section to AGENTS.md`,
      });
    }
  }

  return { name: "Instructions", issues, score: scoreIssues(issues) };
}
