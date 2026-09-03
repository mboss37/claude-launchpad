import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDoctorCommand } from "../src/commands/doctor/index.js";

async function minimalClaudeProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lp-doctor-minscore-"));
  await mkdir(join(root, ".claude"), { recursive: true });
  await writeFile(join(root, "CLAUDE.md"), "# Test\n");
  await writeFile(join(root, ".claude", "settings.json"), "{}\n");
  return root;
}

describe("doctor --json --min-score", () => {
  it("Claude JSON output still exits 1 when the score is below the gate", async () => {
    const root = await minimalClaudeProject();
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("EXIT");
    }) as never);
    const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await expect(
        createDoctorCommand().parseAsync(
          [
            "--path",
            root,
            "--harness",
            "claude",
            "--json",
            "--min-score",
            "101",
          ],
          { from: "user" },
        ),
      ).rejects.toThrow("EXIT");
      expect(exit).toHaveBeenCalledWith(1);
      expect(stdout).toHaveBeenCalled();
      const payload = JSON.parse(String(stdout.mock.calls[0]?.[0])) as {
        overallScore: number;
      };
      expect(payload.overallScore).toBeLessThan(101);
    } finally {
      exit.mockRestore();
      stdout.mockRestore();
    }
  });
});
