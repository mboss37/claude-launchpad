import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";

const BUDGET_WARN = 120;
const BUDGET_DANGER = 150;
const BUDGET_CRITICAL = 200;

export async function analyzeBudget(config: ClaudeConfig): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];
  const count = config.claudeMdInstructionCount;

  if (config.claudeMdContent === null) {
    issues.push({
      analyzer: "Budget",
      severity: "high",
      message: "No CLAUDE.md found",
      fix: "Run `claude-launchpad init` or create CLAUDE.md manually",
    });
    return { name: "Instruction Budget", issues, score: 0 };
  }

  if (count === 0) {
    issues.push({
      analyzer: "Budget",
      severity: "medium",
      message: "CLAUDE.md exists but has no actionable instructions",
      fix: "Add project-specific instructions to CLAUDE.md",
    });
    return { name: "Instruction Budget", issues, score: 30 };
  }

  if (count > BUDGET_CRITICAL) {
    issues.push({
      analyzer: "Budget",
      severity: "critical",
      message: `${count} instructions — way over the ~150 budget. Compliance drops significantly past 150.`,
      fix: "Move detailed rules to .claude/rules/*.md files. Keep CLAUDE.md to essential project identity.",
    });
  } else if (count > BUDGET_DANGER) {
    issues.push({
      analyzer: "Budget",
      severity: "high",
      message: `${count} instructions — over the ~150 budget. Claude may start ignoring lower-priority rules.`,
      fix: "Move verbose sections (conventions, off-limits details) to .claude/rules/ files.",
    });
  } else if (count > BUDGET_WARN) {
    issues.push({
      analyzer: "Budget",
      severity: "medium",
      message: `${count} instructions — approaching the ~150 budget.`,
      fix: "Consider moving some rules to .claude/rules/ to leave headroom.",
    });
  }

  // Score: 100 if under warn, scales down from there
  let score: number;
  if (count <= BUDGET_WARN) {
    score = 100;
  } else if (count <= BUDGET_DANGER) {
    score = 100 - Math.round(((count - BUDGET_WARN) / (BUDGET_DANGER - BUDGET_WARN)) * 30);
  } else if (count <= BUDGET_CRITICAL) {
    score = 70 - Math.round(((count - BUDGET_DANGER) / (BUDGET_CRITICAL - BUDGET_DANGER)) * 40);
  } else {
    score = Math.max(0, 30 - Math.round((count - BUDGET_CRITICAL) / 5));
  }

  return { name: "Instruction Budget", issues, score };
}
