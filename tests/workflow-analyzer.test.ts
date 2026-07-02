import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { analyzeWorkflow } from "../src/commands/doctor/analyzers/workflow.js";

let root: string;
const NOW = new Date("2026-07-02T12:00:00Z");

const FULL_WP = (id: string, proposed: string, priority = "P1"): string => `### ${id} — Do a thing

- **Priority:** ${priority}
- **Proposed:** ${proposed}
- **Stories / Docs:** none yet
- **Depends on:** none
- **Estimate:** S
- **Trigger to pull:** whenever
- **Definition of done:** it is done

One paragraph.
`;

beforeEach(async () => {
  root = join(tmpdir(), `workflow-analyzer-${randomUUID()}`);
  await mkdir(root, { recursive: true });
});

describe("analyzeWorkflow", () => {
  it("returns null when BACKLOG.md is absent (workflow not adopted)", async () => {
    expect(await analyzeWorkflow(root, NOW)).toBeNull();
  });

  it("scores 100 on a healthy backlog", async () => {
    await writeFile(join(root, "BACKLOG.md"),
      `# Backlog\n\n## P1 — Soon\n\n${FULL_WP("WP-001", "2026-06-28")}\n## Changelog\n\n- **2026-06-28:** WP-001 added (P1)\n`);
    const result = await analyzeWorkflow(root, NOW);
    expect(result?.score).toBe(100);
    expect(result?.issues).toHaveLength(0);
  });

  it("flags WP entries missing mandatory template fields", async () => {
    await writeFile(join(root, "BACKLOG.md"),
      "# Backlog\n\n## P1 — Soon\n\n### WP-002 — Vague wish\n\nJust a paragraph, no fields.\n\n## Changelog\n\n- **2026-06-28:** seeded\n");
    const result = await analyzeWorkflow(root, NOW);
    const issue = result?.issues.find((i) => i.message.includes("template fields"));
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("WP-002");
    expect(issue?.severity).toBe("medium");
  });

  it("flags P0 items older than 14 days", async () => {
    await writeFile(join(root, "BACKLOG.md"),
      `# Backlog\n\n## P0 — Next sprint\n\n${FULL_WP("WP-003", "2026-06-01", "P0")}\n## Changelog\n\n- **2026-07-01:** recent entry\n`);
    const result = await analyzeWorkflow(root, NOW);
    const issue = result?.issues.find((i) => i.message.includes("P0"));
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("WP-003");
  });

  it("does not flag a fresh P0 item", async () => {
    await writeFile(join(root, "BACKLOG.md"),
      `# Backlog\n\n## P0 — Next sprint\n\n${FULL_WP("WP-004", "2026-06-30", "P0")}\n## Changelog\n\n- **2026-06-30:** WP-004 added (P0)\n`);
    const result = await analyzeWorkflow(root, NOW);
    expect(result?.issues.filter((i) => i.message.includes("P0"))).toHaveLength(0);
  });

  it("flags a changelog silent for 30+ days while WPs sit in the backlog", async () => {
    await writeFile(join(root, "BACKLOG.md"),
      `# Backlog\n\n## P2 — Later\n\n${FULL_WP("WP-005", "2026-05-01", "P2")}\n## Changelog\n\n- **2026-05-01:** WP-005 added (P2)\n`);
    const result = await analyzeWorkflow(root, NOW);
    const issue = result?.issues.find((i) => i.message.includes("silent"));
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("low");
  });

  it("does not flag changelog silence on an empty backlog", async () => {
    await writeFile(join(root, "BACKLOG.md"),
      "# Backlog\n\n## P0 — Next sprint\n\n<!-- Empty. -->\n\n## Changelog\n\n- **2026-01-01:** established\n");
    const result = await analyzeWorkflow(root, NOW);
    expect(result?.issues).toHaveLength(0);
  });
});
