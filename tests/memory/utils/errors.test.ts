import { describe, it, expect } from "vitest";
import {
  formatError,
  formatMcpError,
  memoryNotFound,
} from "../../../src/commands/memory/utils/errors.js";

describe("formatError", () => {
  it("formats what/why/fix into readable string", () => {
    const msg = formatError({
      what: "Something broke.",
      why: "Bad input.",
      fix: "Try again.",
    });

    expect(msg).toContain("Something broke.");
    expect(msg).toContain("Why: Bad input.");
    expect(msg).toContain("Fix: Try again.");
  });
});

describe("formatMcpError", () => {
  it("wraps structured error in MCP error format", () => {
    const result = formatMcpError(memoryNotFound("abc-123"));

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("abc-123");
  });
});

describe("memoryNotFound", () => {
  it("includes the id and a search suggestion", () => {
    const err = memoryNotFound("xyz");
    expect(err.what).toContain("xyz");
    expect(err.fix).toContain("memory_search");
  });
});
