import { describe, it, expect } from "vitest";
import { detectProject } from "../src/lib/detect.js";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");

describe("detectProject", () => {
  it("detects this project as TypeScript", async () => {
    const result = await detectProject(PROJECT_ROOT);
    expect(result.language).toBe("TypeScript");
    expect(result.packageManager).toBe("pnpm");
    expect(result.name).toBe("claude-launchpad");
  });

  it("detects dev and test commands from package.json scripts", async () => {
    const result = await detectProject(PROJECT_ROOT);
    expect(result.devCommand).toBe("pnpm dev");
    expect(result.testCommand).toBe("pnpm test");
    expect(result.buildCommand).toBe("pnpm build");
  });

  it("returns null language for empty directory", async () => {
    const result = await detectProject("/tmp");
    expect(result.language).toBeNull();
    expect(result.framework).toBeNull();
  });
});
