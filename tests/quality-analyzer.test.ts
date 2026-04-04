import { describe, it, expect } from "vitest";
import { analyzeQuality } from "../src/commands/doctor/analyzers/quality.js";
import type { ClaudeConfig } from "../src/types/index.js";

function makeConfig(content: string | null): ClaudeConfig {
  return {
    claudeMdPath: content ? "/test/CLAUDE.md" : null,
    claudeMdContent: content,
    claudeMdInstructionCount: 50,
    settingsPath: null,
    settings: null,
    hooks: [],
    rules: [],
    mcpServers: [],
    skills: [],
    claudeignorePath: null,
    claudeignoreContent: null,
  };
}

describe("analyzeQuality", () => {
  it("scores high for complete CLAUDE.md", async () => {
    const content = `# My Project
## Stack
- TypeScript
## Commands
- Dev: pnpm dev
## Session Start
- Read TASKS.md
## Architecture
- Monorepo
## Off-Limits
- Never hardcode secrets
## Backlog
- Use BACKLOG.md for deferred features
## Memory & Learnings
- Use built-in memory system
`;
    const result = await analyzeQuality(makeConfig(content));
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it("flags missing essential sections", async () => {
    const content = `# My Project
Just some random text with no sections.
`;
    const result = await analyzeQuality(makeConfig(content));
    expect(result.issues.length).toBeGreaterThanOrEqual(4);
    expect(result.issues.some((i) => i.message.includes("Stack"))).toBe(true);
    expect(result.issues.some((i) => i.message.includes("Commands"))).toBe(true);
    expect(result.score).toBeLessThan(50);
  });

  it("flags vague instructions", async () => {
    const content = `# My Project
## Stack
## Commands
## Session Start
## Off-Limits
## Architecture
Always follow best practices and write good code.
`;
    const result = await analyzeQuality(makeConfig(content));
    expect(result.issues.some((i) => i.message.includes("Vague"))).toBe(true);
  });

  it("flags hardcoded secrets as critical", async () => {
    const content = `# My Project
## Stack
API key: sk-abcdefghijklmnopqrstuvwxyz1234
`;
    const result = await analyzeQuality(makeConfig(content));
    expect(result.issues.some((i) => i.severity === "critical")).toBe(true);
  });

  it("returns score 0 when no CLAUDE.md exists", async () => {
    const result = await analyzeQuality(makeConfig(null));
    expect(result.score).toBe(0);
  });

  it("flags excessive TODOs", async () => {
    const content = `# My Project
## Stack
<!-- TODO: fill in -->
## Commands
<!-- TODO: fill in -->
## Session Start
<!-- TODO: fill in -->
## Off-Limits
<!-- TODO: fill in -->
## Architecture
<!-- TODO: fill in -->
`;
    const result = await analyzeQuality(makeConfig(content));
    expect(result.issues.some((i) => i.message.includes("TODO"))).toBe(true);
  });
});
