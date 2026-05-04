import type { ClaudeConfig, AnalyzerResult, DiagnosticIssue } from "../../../types/index.js";
import { hasMemoryIndicators } from "./memory.js";
import {
  INTENT_RULES,
  MEMORY_INTENT,
  parseSections,
  documentSatisfiesIntent,
} from "./quality-intents.js";

const VAGUE_PATTERNS = [
  { pattern: /write (good|clean|quality|nice) code/i, label: "write good code" },
  { pattern: /be (careful|thorough|diligent)/i, label: "be careful" },
  { pattern: /follow best practices/i, label: "follow best practices" },
  { pattern: /make sure (everything|it) works/i, label: "make sure it works" },
] as const;

const SECRET_PATTERNS = [
  { pattern: /sk-[a-zA-Z0-9]{20,}/, label: "OpenAI API key" },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, label: "GitHub personal token" },
  { pattern: /AKIA[0-9A-Z]{16}/, label: "AWS access key" },
  { pattern: /xoxb-[0-9]+-[a-zA-Z0-9]+/, label: "Slack bot token" },
] as const;

export async function analyzeQuality(config: ClaudeConfig, projectRoot: string): Promise<AnalyzerResult> {
  const issues: DiagnosticIssue[] = [];
  const content = config.claudeMdContent;

  if (content === null) {
    issues.push({
      analyzer: "Quality",
      severity: "high",
      message: "No CLAUDE.md found",
      fix: "Run `claude-launchpad init` to generate one",
    });
    return { name: "CLAUDE.md Quality", issues, score: 0 };
  }

  // Check essential sections via intent detection (keyword-based, not exact heading match).
  // Memory intent only checked if memory is installed.
  const rules = await hasMemoryIndicators(config, projectRoot)
    ? [...INTENT_RULES, MEMORY_INTENT]
    : [...INTENT_RULES];
  const combinedContent = [content, config.localClaudeMdContent].filter(Boolean).join("\n\n");
  const sections = parseSections(combinedContent);
  for (const rule of rules) {
    if (!documentSatisfiesIntent(sections, rule)) {
      issues.push({
        analyzer: "Quality",
        severity: "medium",
        message: `Missing "## ${rule.name}" section — ${rule.why}`,
        fix: `Add a ## ${rule.name} section to CLAUDE.md`,
      });
    }
  }

  // Check for vague/useless instructions
  for (const vague of VAGUE_PATTERNS) {
    if (vague.pattern.test(content)) {
      issues.push({
        analyzer: "Quality",
        severity: "low",
        message: `Vague instruction detected: "${vague.label}" — zero signal, wastes budget`,
        fix: "Replace with specific, actionable instructions",
      });
    }
  }

  // Check for hardcoded secrets
  for (const secret of SECRET_PATTERNS) {
    if (secret.pattern.test(content)) {
      issues.push({
        analyzer: "Quality",
        severity: "critical",
        message: `Possible ${secret.label} found in CLAUDE.md — secrets must never be in config files`,
        fix: "Remove the secret immediately and rotate it",
      });
    }
  }

  // Check for TODO placeholders (unfinished config)
  const todoCount = (content.match(/<!--\s*TODO/gi) ?? []).length;
  if (todoCount > 3) {
    issues.push({
      analyzer: "Quality",
      severity: "medium",
      message: `${todoCount} TODO placeholders — CLAUDE.md is mostly unfinished`,
      fix: "Fill in the TODO sections or remove them",
    });
  }

  // Duplicate Memory headings — happens when /lp-enhance wrote `## Memory` first
  // and memory install later appended `## Memory (agentic-memory)` (or vice-versa).
  const plainMemory = (content.match(/^## Memory\s*$/gm) ?? []).length;
  const taggedMemory = (content.match(/^## Memory \(agentic-memory\)\s*$/gm) ?? []).length;
  if (plainMemory + taggedMemory > 1) {
    issues.push({
      analyzer: "Quality",
      severity: "medium",
      message: "Duplicate ## Memory headings in CLAUDE.md — memory install appended a second block",
      fix: "Run `doctor --fix` to collapse them",
    });
  }

  // Score: base 100, deduct per issue
  const criticals = issues.filter((i) => i.severity === "critical").length;
  const highs = issues.filter((i) => i.severity === "high").length;
  const mediums = issues.filter((i) => i.severity === "medium").length;
  const lows = issues.filter((i) => i.severity === "low").length;

  const score = Math.max(0, 100 - criticals * 40 - highs * 30 - mediums * 15 - lows * 5);
  return { name: "CLAUDE.md Quality", issues, score };
}
