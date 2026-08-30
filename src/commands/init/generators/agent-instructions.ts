import type { DetectedProject, InitOptions } from "../../../types/index.js";
import {
  BACKLOG_CONTENT,
  OFF_LIMITS_CONTENT,
  SESSION_START_CONTENT,
  STOP_AND_SWARM_CONTENT,
  sprintReviewsContent,
} from "../../../lib/sections.js";

export interface AgentInstructionSection {
  readonly heading: string;
  readonly lines: ReadonlyArray<string>;
}

export interface AgentInstructionDocument {
  readonly title: string;
  readonly description: string;
  readonly sections: ReadonlyArray<AgentInstructionSection>;
}

export function buildAgentInstructions(
  options: InitOptions,
  detected: DetectedProject,
  features: { readonly superpowers: boolean },
): AgentInstructionDocument {
  return {
    title: options.name,
    description: options.description,
    sections: [
      stackSection(detected),
      commandsSection(detected),
      { heading: "Session Start", lines: SESSION_START_CONTENT.split("\n") },
      { heading: "Backlog", lines: BACKLOG_CONTENT.split("\n") },
      {
        heading: "Sprint Reviews",
        lines: sprintReviewsContent(
          detected.testCommand,
          detected.lintCommand,
          features.superpowers,
        ).split("\n"),
      },
      {
        heading: "Conventions",
        lines: [
          "- Git: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)",
        ],
      },
      { heading: "Stop-and-Swarm", lines: STOP_AND_SWARM_CONTENT.split("\n") },
      { heading: "Off-Limits", lines: OFF_LIMITS_CONTENT.split("\n") },
      {
        heading: "Key Decisions",
        lines: [
          "<!-- Append one entry per non-obvious choice, at the moment it's made — not at sprint close: -->",
          "<!-- YYYY-MM-DD — Chose X over Y because Z. Revisit if W. -->",
        ],
      },
    ],
  };
}

export function renderAgentInstructions(doc: AgentInstructionDocument): string {
  const parts = [`# ${doc.title}`];
  if (doc.description) parts.push("", doc.description);
  for (const section of doc.sections) {
    parts.push("", `## ${section.heading}`, ...section.lines);
  }
  return `${parts.join("\n")}\n`;
}

function stackSection(detected: DetectedProject): AgentInstructionSection {
  if (!detected.language) {
    return {
      heading: "Stack",
      lines: ["<!-- TODO: Define your tech stack -->"],
    };
  }
  const lines = [
    ...(detected.framework ? [`- **Framework**: ${detected.framework}`] : []),
    `- **Language**: ${detected.language}`,
    ...(detected.packageManager
      ? [`- **Package Manager**: ${detected.packageManager}`]
      : []),
  ];
  return { heading: "Stack", lines };
}

function commandsSection(detected: DetectedProject): AgentInstructionSection {
  const lines = [
    ...(detected.devCommand ? [`- Dev: \`${detected.devCommand}\``] : []),
    ...(detected.buildCommand ? [`- Build: \`${detected.buildCommand}\``] : []),
    ...(detected.testCommand ? [`- Test: \`${detected.testCommand}\``] : []),
    ...(detected.lintCommand ? [`- Lint: \`${detected.lintCommand}\``] : []),
    ...(detected.formatCommand
      ? [`- Format: \`${detected.formatCommand}\``]
      : []),
  ];
  return {
    heading: "Commands",
    lines:
      lines.length > 0
        ? lines
        : ["<!-- TODO: Add your dev/build/test commands -->"],
  };
}
