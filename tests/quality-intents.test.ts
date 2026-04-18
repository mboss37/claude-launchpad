import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INTENT_RULES,
  MEMORY_INTENT,
  parseSections,
  sectionSatisfiesIntent,
  documentSatisfiesIntent,
} from "../src/commands/doctor/analyzers/quality-intents.js";
import { analyzeQuality } from "../src/commands/doctor/analyzers/quality.js";
import type { ClaudeConfig } from "../src/types/index.js";

const FIXTURES_DIR = join(__dirname, "fixtures");
const MATURE = readFileSync(join(FIXTURES_DIR, "mature-project.md"), "utf-8");
const NEW_PROJECT = readFileSync(join(FIXTURES_DIR, "new-project.md"), "utf-8");

function makeConfig(content: string): ClaudeConfig {
  return {
    claudeMdPath: "/test/CLAUDE.md",
    claudeMdContent: content,
    claudeMdInstructionCount: 50,
    settingsPath: null,
    settings: null,
    localClaudeMdContent: null,
    localSettings: null,
    hooks: [],
    rules: [],
    mcpServers: [],
    skills: [],
    claudeignorePath: null,
    claudeignoreContent: null,
  };
}

describe("parseSections", () => {
  it("returns an empty array for a document with no ## headings", () => {
    expect(parseSections("# Title\n\nSome body paragraph with no H2.\n")).toEqual([]);
  });

  it("flags sections wrapped in LP-STUB markers as stubs", () => {
    const sections = parseSections(NEW_PROJECT);
    expect(sections).toHaveLength(7);
    expect(sections.every((s) => s.isStub)).toBe(true);
  });

  it("does not flag non-stub sections as stubs", () => {
    const sections = parseSections(MATURE);
    expect(sections.every((s) => !s.isStub)).toBe(true);
  });
});

describe("sectionSatisfiesIntent", () => {
  const sessionStart = INTENT_RULES.find((r) => r.name === "Session Start")!;
  const offLimits = INTENT_RULES.find((r) => r.name === "Off-Limits")!;

  it("matches via heading alias (Sprint Planning satisfies Session Start)", () => {
    const [sprintPlanning] = parseSections("## Sprint Planning\n\nUnrelated text.");
    expect(sectionSatisfiesIntent(sprintPlanning, sessionStart)).toBe(true);
  });

  it("matches via body keywords when heading doesn't match", () => {
    const [custom] = parseSections(
      "## Daily Flow\n\nRead TASKS.md first to see where we left off. Track progress in the session log.",
    );
    expect(sectionSatisfiesIntent(custom, sessionStart)).toBe(true);
  });

  it("does not satisfy when section is stub-wrapped, even if heading matches", () => {
    const [stub] = parseSections(
      "## Session Start\n<!-- LP-STUB: ai-recommended -->\nReal content here.\n<!-- /LP-STUB -->",
    );
    expect(stub.isStub).toBe(true);
    expect(sectionSatisfiesIntent(stub, sessionStart)).toBe(false);
  });

  it("matches Off-Limits via 'Security Notes' heading alias", () => {
    const [securityNotes] = parseSections(
      "## Security Notes\n\n- Never commit .env files\n- Do not write passwords to logs",
    );
    expect(sectionSatisfiesIntent(securityNotes, offLimits)).toBe(true);
  });
});

describe("documentSatisfiesIntent + analyzeQuality", () => {
  it("mature project satisfies every base intent (zero Quality section flags)", () => {
    const sections = parseSections(MATURE);
    for (const rule of INTENT_RULES) {
      expect(documentSatisfiesIntent(sections, rule), `intent: ${rule.name}`).toBe(true);
    }
  });

  it("new project (all stubs) fails every base intent", () => {
    const sections = parseSections(NEW_PROJECT);
    for (const rule of INTENT_RULES) {
      expect(documentSatisfiesIntent(sections, rule), `intent: ${rule.name}`).toBe(false);
    }
  });

  it("analyzeQuality on mature project flags no missing sections", async () => {
    const result = await analyzeQuality(makeConfig(MATURE), "/test");
    const missingSections = result.issues.filter((i) => i.message.startsWith("Missing"));
    expect(missingSections).toHaveLength(0);
  });

  it("analyzeQuality on new project flags all base sections as missing", async () => {
    const result = await analyzeQuality(makeConfig(NEW_PROJECT), "/test");
    const missingSections = result.issues.filter((i) => i.message.startsWith("Missing"));
    expect(missingSections).toHaveLength(INTENT_RULES.length);
    expect(missingSections.some((i) => i.message.includes("Session Start"))).toBe(true);
    expect(missingSections.some((i) => i.message.includes("Stop-and-Swarm"))).toBe(true);
  });

  it("Memory intent matches on canonical heading or keyword", () => {
    const [sec] = parseSections("## Memory\n\nUse memory_search before memory_store.");
    expect(sectionSatisfiesIntent(sec, MEMORY_INTENT)).toBe(true);
    const [sec2] = parseSections("## Learnings\n\nStick with agentic-memory for cross-session state.");
    expect(sectionSatisfiesIntent(sec2, MEMORY_INTENT)).toBe(true);
  });
});
