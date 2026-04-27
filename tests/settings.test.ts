import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSettingsJson, readSettingsLocalJson } from "../src/lib/settings.js";

describe("readSettingsJson", () => {
  let root: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lp-settings-"));
    mkdirSync(join(root, ".claude"), { recursive: true });
    warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    warnSpy.mockRestore();
  });

  it("returns {} when settings.json is missing", async () => {
    const result = await readSettingsJson(root);
    expect(result).toEqual({});
  });

  it("returns parsed object when settings.json is valid JSON", async () => {
    writeFileSync(join(root, ".claude", "settings.json"), JSON.stringify({ permissions: { deny: ["Bash(rm -rf /)"] } }));
    const result = await readSettingsJson(root);
    expect(result).toEqual({ permissions: { deny: ["Bash(rm -rf /)"] } });
  });

  it("returns null and warns when settings.json contains invalid JSON", async () => {
    writeFileSync(join(root, ".claude", "settings.json"), "{ this is: not valid JSON,");
    const result = await readSettingsJson(root);
    expect(result).toBeNull();
    const warned = warnSpy.mock.calls.some(([msg]) => typeof msg === "string" && msg.includes("not valid JSON"));
    expect(warned).toBe(true);
  });
});

describe("readSettingsLocalJson", () => {
  let root: string;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lp-settings-local-"));
    mkdirSync(join(root, ".claude"), { recursive: true });
    warnSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    warnSpy.mockRestore();
  });

  it("returns {} when settings.local.json is missing", async () => {
    const result = await readSettingsLocalJson(root);
    expect(result).toEqual({});
  });

  it("returns null and warns when settings.local.json contains invalid JSON", async () => {
    writeFileSync(join(root, ".claude", "settings.local.json"), "}}}not json{{{");
    const result = await readSettingsLocalJson(root);
    expect(result).toBeNull();
    const warned = warnSpy.mock.calls.some(([msg]) => typeof msg === "string" && msg.includes("not valid JSON"));
    expect(warned).toBe(true);
  });
});
