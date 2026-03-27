import { describe, it, expect } from "vitest";
import { countInstructions } from "../src/lib/parser.js";

describe("countInstructions", () => {
  it("counts non-empty, non-structural lines as instructions", () => {
    const content = `# My Project

## Stack
- **Framework**: Next.js
- **Database**: Supabase

## Off-Limits
- Never hardcode secrets
- Never write to .env files
`;
    // Lines counted: "- **Framework**...", "- **Database**...", "- Never hardcode...", "- Never write..."
    // Not counted: headings, empty lines
    const count = countInstructions(content);
    expect(count).toBe(4);
  });

  it("skips HTML comments", () => {
    const content = `# Project
<!-- This is a comment -->
- Real instruction
<!-- Another comment -->
`;
    expect(countInstructions(content)).toBe(1);
  });

  it("skips code fence markers but counts code content", () => {
    const content = `## Commands
\`\`\`
pnpm dev
pnpm build
\`\`\`
`;
    // "pnpm dev" and "pnpm build" are content lines inside the fence
    expect(countInstructions(content)).toBe(2);
  });

  it("returns 0 for empty content", () => {
    expect(countInstructions("")).toBe(0);
  });

  it("returns 0 for only headings and blank lines", () => {
    const content = `# Title

## Section

## Another Section
`;
    expect(countInstructions(content)).toBe(0);
  });
});
