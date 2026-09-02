import { describe, expect, it } from "vitest";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { registerCursorMemoryMcp } from "../src/commands/memory/cursor-mcp.js";
import { isMemoryMcpRegistered } from "../src/lib/memory-registration.js";
import { isMemoryInstalledAt } from "../src/commands/memory/index.js";
import {
  CURSOR_CLOUD_MEMORY_WARNING,
  detectExistingSetup,
  existingSetupLabel,
  injectAgentsMdGuidance,
  knowledgeBaseStepLabel,
  missingGhAdvice,
} from "../src/commands/memory/subcommands/install.js";
import {
  checkAutoMemory,
  checkCursorMemoryMcp,
} from "../src/commands/memory/subcommands/doctor.js";

describe("registerCursorMemoryMcp", () => {
  it("writes the existing memory serve command into .cursor/mcp.json", async () => {
    const root = join(tmpdir(), `mem-cursor-mcp-${randomUUID()}`);
    await mkdir(root, { recursive: true });
    const added = registerCursorMemoryMcp(root);
    expect(added).toBe(true);
    const raw = JSON.parse(
      await readFile(join(root, ".cursor", "mcp.json"), "utf-8"),
    ) as { mcpServers: Record<string, { command: string; args: string[] }> };
    expect(raw.mcpServers["agentic-memory"]).toEqual({
      command: "npx",
      args: ["claude-launchpad", "memory", "serve"],
    });
    expect(isMemoryMcpRegistered(root)).toBe(true);
    expect(isMemoryInstalledAt(root)).toBe(true);
    expect(detectExistingSetup(root)).not.toBeNull();
    expect(existingSetupLabel(root, "shared")).toBe(".cursor/mcp.json");
  });

  it("does not treat Claude MCP without a SessionStart hook as installed", async () => {
    const root = join(tmpdir(), `mem-claude-mcp-only-${randomUUID()}`);
    await mkdir(root, { recursive: true });
    await writeFile(
      join(root, ".mcp.json"),
      JSON.stringify({
        mcpServers: { "agentic-memory": { command: "npx" } },
      }),
    );
    expect(isMemoryMcpRegistered(root)).toBe(true);
    expect(isMemoryInstalledAt(root)).toBe(false);
  });

  it("merges agentic-memory without dropping other servers", async () => {
    const root = join(tmpdir(), `mem-cursor-mcp-${randomUUID()}`);
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(
      join(root, ".cursor", "mcp.json"),
      JSON.stringify({
        mcpServers: { custom: { url: "https://example.test/mcp" } },
      }),
    );
    registerCursorMemoryMcp(root);
    const raw = JSON.parse(
      await readFile(join(root, ".cursor", "mcp.json"), "utf-8"),
    ) as { mcpServers: Record<string, unknown> };
    expect(Object.keys(raw.mcpServers)).toEqual(["custom", "agentic-memory"]);
  });

  it("is idempotent when agentic-memory is already registered", async () => {
    const root = join(tmpdir(), `mem-cursor-mcp-${randomUUID()}`);
    await mkdir(root, { recursive: true });
    expect(registerCursorMemoryMcp(root)).toBe(true);
    expect(registerCursorMemoryMcp(root)).toBe(false);
  });

  it("refuses to overwrite a malformed .cursor/mcp.json", async () => {
    const root = join(tmpdir(), `mem-cursor-mcp-bad-${randomUUID()}`);
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, ".cursor", "mcp.json"), "{not-json");
    expect(() => registerCursorMemoryMcp(root)).toThrow(/unreadable/i);
  });

  it("refuses mcpServers that is not an object map", async () => {
    const root = join(tmpdir(), `mem-cursor-mcp-list-${randomUUID()}`);
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(
      join(root, ".cursor", "mcp.json"),
      JSON.stringify({ mcpServers: [{ name: "other" }] }),
    );
    expect(() => registerCursorMemoryMcp(root)).toThrow(/unreadable/i);
  });
});

describe("injectAgentsMdGuidance", () => {
  it("appends memory guidance to an existing AGENTS.md", async () => {
    const root = join(tmpdir(), `mem-agents-${randomUUID()}`);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# Cursor\n");
    expect(injectAgentsMdGuidance(root)).toBe(true);
    const after = await readFile(join(root, "AGENTS.md"), "utf-8");
    expect(after).toContain("## Memory (agentic-memory)");
    expect(after).toMatch(/memory_search/i);
    expect(after).not.toMatch(/automatically injected|SessionStart/i);
    expect(injectAgentsMdGuidance(root)).toBe(false);
  });

  it("labels AGENTS.md memory guidance without claiming Claude files", async () => {
    const root = join(tmpdir(), `mem-agents-label-${randomUUID()}`);
    await mkdir(root, { recursive: true });
    await writeFile(
      join(root, "AGENTS.md"),
      "# Cursor\n\n## Memory (agentic-memory)\nUse memory_search.\n",
    );
    expect(detectExistingSetup(root)).toBe("shared");
    expect(existingSetupLabel(root, "shared")).toBe("AGENTS.md");
  });

  it("does not create AGENTS.md when the project has none", async () => {
    const root = join(tmpdir(), `mem-agents-missing-${randomUUID()}`);
    await mkdir(root, { recursive: true });
    expect(injectAgentsMdGuidance(root)).toBe(false);
  });
});

describe("checkAutoMemory", () => {
  it("does not tell Cursor-only installs to run memory install", async () => {
    const root = join(tmpdir(), `mem-doctor-cursor-${randomUUID()}`);
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# Cursor\n");
    await writeFile(
      join(root, ".cursor", "mcp.json"),
      JSON.stringify({
        mcpServers: { "agentic-memory": { command: "npx" } },
      }),
    );
    const result = await checkAutoMemory(root);
    expect(result.status).toBe("PASS");
    expect(result.detail).not.toMatch(/memory install/i);
  });
});

describe("checkCursorMemoryMcp", () => {
  it("warns when Cursor is present but agentic-memory is not registered", async () => {
    const root = join(tmpdir(), `mem-doctor-mcp-missing-${randomUUID()}`);
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# Cursor\n");
    const result = await checkCursorMemoryMcp(root);
    expect(result.status).toBe("WARN");
    expect(result.detail).toMatch(/memory install --harness cursor/i);
  });

  it("passes when Cursor mcp.json has agentic-memory", async () => {
    const root = join(tmpdir(), `mem-doctor-mcp-ok-${randomUUID()}`);
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# Cursor\n");
    await writeFile(
      join(root, ".cursor", "mcp.json"),
      JSON.stringify({
        mcpServers: { "agentic-memory": { command: "npx" } },
      }),
    );
    const result = await checkCursorMemoryMcp(root);
    expect(result.status).toBe("PASS");
  });
});

describe("memory install copy", () => {
  it("drops Claude [1/5] chrome for Cursor-only installs", () => {
    expect(knowledgeBaseStepLabel(["cursor"])).toBe(
      "Creating knowledge base...",
    );
    expect(knowledgeBaseStepLabel(["claude"])).toMatch(/^\[1\/5\]/);
    expect(knowledgeBaseStepLabel(["claude", "cursor"])).toMatch(/^\[1\/5\]/);
  });

  it("does not imply session auto-sync when only Cursor is targeted", () => {
    expect(missingGhAdvice(["cursor"])).toMatch(/memory push/i);
    expect(missingGhAdvice(["cursor"])).not.toMatch(/auto-sync/i);
    expect(missingGhAdvice(["claude"])).toMatch(/cross-device memory sync/i);
  });

  it("states that Cursor Cloud cannot use the local MCP server", () => {
    expect(CURSOR_CLOUD_MEMORY_WARNING).toMatch(/cloud/i);
    expect(CURSOR_CLOUD_MEMORY_WARNING).toMatch(/local/i);
  });
});
