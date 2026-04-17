/**
 * Intent-based section detection for CLAUDE.md quality analysis.
 *
 * Replaces the old BASE_SECTIONS regex loop that required an exact heading match
 * (e.g. `## Session Start`). Now a section satisfies an intent when either its
 * heading matches a pattern OR its body contains enough intent-signalling keywords.
 * A section wrapped in LP-STUB markers never satisfies an intent — stubs are
 * scaffolding, not real content.
 */

import { LP_STUB_OPEN } from "../../../lib/stub-marker.js";

export interface IntentRule {
  readonly name: string;
  readonly why: string;
  readonly headingPatterns: readonly RegExp[];
  readonly bodyKeywords: readonly RegExp[];
  readonly minBodyKeywords: number;
}

export interface ParsedSection {
  readonly heading: string;
  readonly body: string;
  readonly isStub: boolean;
}

export const INTENT_RULES: readonly IntentRule[] = [
  {
    name: "Stack",
    why: "Claude performs worse without knowing the tech stack",
    headingPatterns: [/^tech\s+stack$/i, /^stack$/i, /^technology$/i, /^tech$/i],
    bodyKeywords: [
      /\blanguage:/i,
      /\bframework:/i,
      /\bpackage\s+manager:/i,
      /\bruntime:/i,
      /\b(typescript|javascript|python|ruby|go|rust|java|php|swift|kotlin)\b/i,
      /\b(react|next\.?js|vue|svelte|angular|express|fastify|laravel|rails|django|flask)\b/i,
      /\b(node(?:\.?js)?|deno|bun|cpython)\b/i,
    ],
    minBodyKeywords: 2,
  },
  {
    name: "Commands",
    why: "Claude guesses wrong without explicit dev/build/test commands",
    headingPatterns: [/^commands?$/i, /^scripts$/i, /^dev\s+commands$/i, /^development$/i],
    bodyKeywords: [
      /\b(pnpm|npm|yarn|bun)\s+\w+/i,
      /\b(build|test|dev|lint|typecheck|start):/i,
      /\brun\s+(tests?|build|dev)/i,
      /\bmake\s+\w+/i,
      /\bcargo\s+\w+/i,
    ],
    minBodyKeywords: 2,
  },
  {
    name: "Session Start",
    why: "Without this, Claude won't read TASKS.md or maintain continuity",
    headingPatterns: [
      /^session\s+start$/i,
      /^session$/i,
      /^sprint\s+planning$/i,
      /^workflow$/i,
      /^getting\s+started$/i,
      /^at\s+session\s+start$/i,
    ],
    bodyKeywords: [
      /\btasks?\.md\b/i,
      /\bsession\s+(start|log)\b/i,
      /\bsprint\s+(log|planning)\b/i,
      /\b(read|check).*at\s+(session|start)/i,
      /\btrack\s+progress/i,
    ],
    minBodyKeywords: 1,
  },
  {
    name: "Off-Limits",
    why: "Without guardrails, Claude has no boundaries beyond defaults",
    headingPatterns: [
      /^off.?limits$/i,
      /^constraints$/i,
      /^don'?t$/i,
      /^rules$/i,
      /^guardrails$/i,
      /^forbidden$/i,
      /^security\s+notes$/i,
    ],
    bodyKeywords: [
      /\bnever\s+\w+/i,
      /\bforbidden/i,
      /\bdo\s+not\b/i,
      /\b(secret|credential|api\s+key|password|token)/i,
      /\.env\b/,
    ],
    minBodyKeywords: 2,
  },
  {
    name: "Architecture/Structure",
    why: "Claude makes better decisions when it understands the codebase shape",
    headingPatterns: [
      /^architecture$/i,
      /^project\s+structure$/i,
      /^structure$/i,
      /^codebase$/i,
      /^layout$/i,
      /^repo\s+layout$/i,
    ],
    bodyKeywords: [
      /\bsrc\//,
      /\b(directory|directories|folder|module|layer)\b/i,
      /\barchitecture\b/i,
    ],
    minBodyKeywords: 1,
  },
  {
    name: "Backlog",
    why: "Without backlog instructions, deferred features get lost in conversation history",
    headingPatterns: [
      /^backlog$/i,
      /^roadmap$/i,
      /^parked$/i,
      /^future\s+work$/i,
      /^parked\s+features?$/i,
    ],
    bodyKeywords: [
      /\bbacklog\.md\b/i,
      /\bbacklog\b/i,
      /\bdeferred\b/i,
      /\bparked\s+features?\b/i,
    ],
    minBodyKeywords: 1,
  },
  {
    name: "Stop-and-Swarm",
    why: "Without a stop-and-swarm rule, Claude keeps guessing in circles instead of parallelizing research",
    headingPatterns: [
      /^stop.and.swarm$/i,
      /^when\s+stuck$/i,
      /^debug$/i,
      /^escalation$/i,
      /^swarm$/i,
      /^parallel\s+agents?$/i,
    ],
    bodyKeywords: [
      /\bstop-and-swarm\b/i,
      /\bparallel\s+agents?\b/i,
      /\bspin\s+up\b/i,
      /\b(3|three)\s+(parallel\s+)?agents?\b/i,
      /\bfailed\s+iterations?\b/i,
    ],
    minBodyKeywords: 1,
  },
] as const;

export const MEMORY_INTENT: IntentRule = {
  name: "Memory & Learnings",
  why: "Without memory instructions, Claude forgets learnings and repeats mistakes across sessions",
  headingPatterns: [/^memory$/i, /^learnings?$/i, /^memory\s*(&|and)\s*learnings?$/i],
  bodyKeywords: [
    /\bmemory_search\b/i,
    /\bmemory_store\b/i,
    /\bagentic-memory\b/i,
    /\bstore\s+memories?\b/i,
    /\binject(ed)?\s+(at|in|into)\s+(session|startup)/i,
  ],
  minBodyKeywords: 1,
} as const;

export function parseSections(content: string): ParsedSection[] {
  const lines = content.split("\n");
  const sections: ParsedSection[] = [];
  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  const flush = (): void => {
    if (currentHeading === null) return;
    const body = currentBody.join("\n");
    sections.push({
      heading: currentHeading,
      body,
      isStub: body.includes(LP_STUB_OPEN),
    });
  };

  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      flush();
      currentHeading = match[1];
      currentBody = [];
    } else if (currentHeading !== null) {
      currentBody.push(line);
    }
  }
  flush();

  return sections;
}

export function sectionSatisfiesIntent(section: ParsedSection, rule: IntentRule): boolean {
  if (section.isStub) return false;

  const headingMatch = rule.headingPatterns.some((p) => p.test(section.heading));
  if (headingMatch) return true;

  const keywordHits = rule.bodyKeywords.reduce(
    (n, p) => (p.test(section.body) ? n + 1 : n),
    0,
  );
  return keywordHits >= rule.minBodyKeywords;
}

export function documentSatisfiesIntent(
  sections: readonly ParsedSection[],
  rule: IntentRule,
): boolean {
  return sections.some((s) => sectionSatisfiesIntent(s, rule));
}
