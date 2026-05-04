import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../../lib/output.js";
import { fileExists } from "../../lib/fs-utils.js";
import { generateWorkflowRule } from "../init/generators/workflow-rule.js";
import { generateHooksRule } from "../init/generators/hooks-rule.js";

export async function createWorkflowRule(root: string): Promise<boolean> {
  const rulesDir = join(root, ".claude", "rules");
  const workflowPath = join(rulesDir, "workflow.md");
  if (await fileExists(workflowPath)) return false;

  await mkdir(rulesDir, { recursive: true });
  await writeFile(workflowPath, generateWorkflowRule());
  log.success("Created .claude/rules/workflow.md (path-scoped BACKLOG/TASKS workflow rules)");
  return true;
}

export async function createHooksRule(root: string): Promise<boolean> {
  const rulesDir = join(root, ".claude", "rules");
  const hooksPath = join(rulesDir, "hooks.md");
  if (await fileExists(hooksPath)) return false;

  await mkdir(rulesDir, { recursive: true });
  await writeFile(hooksPath, generateHooksRule());
  log.success("Created .claude/rules/hooks.md (path-scoped hook authoring rules)");
  return true;
}

type MemoryBlock = { readonly startIdx: number; readonly endIdx: number; readonly tagged: boolean };

function isMemoryHeading(line: string): boolean {
  return /^## Memory( \(agentic-memory\))?\s*$/.test(line);
}

function findMemoryBlocks(lines: readonly string[]): readonly MemoryBlock[] {
  const blocks: MemoryBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isMemoryHeading(lines[i])) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^## /.test(lines[j])) { end = j; break; }
    }
    blocks.push({ startIdx: i, endIdx: end, tagged: lines[i].includes("(agentic-memory)") });
    i = end - 1;
  }
  return blocks;
}

/**
 * Collapse duplicate `## Memory` / `## Memory (agentic-memory)` sections in CLAUDE.md.
 * Keeps the first `## Memory (agentic-memory)` block (canonical), or the first plain
 * `## Memory` block if no tagged one exists. Drops all subsequent memory sections.
 */
export async function collapseMemoryHeadings(root: string): Promise<boolean> {
  const claudeMdPath = join(root, "CLAUDE.md");
  let content: string;
  try {
    content = await readFile(claudeMdPath, "utf-8");
  } catch {
    return false;
  }

  const lines = content.split("\n");
  const blocks = findMemoryBlocks(lines);
  if (blocks.length <= 1) return false;

  const keeper = blocks.find((b) => b.tagged) ?? blocks[0];
  const droppedByStart = new Map<number, MemoryBlock>(
    blocks.filter((b) => b !== keeper).map((b) => [b.startIdx, b]),
  );

  const kept: string[] = [];
  let skipUntil = -1;
  for (let i = 0; i < lines.length; i++) {
    if (i < skipUntil) continue;
    const dropped = droppedByStart.get(i);
    if (dropped) { skipUntil = dropped.endIdx; continue; }
    kept.push(lines[i]);
  }

  // Canonicalize the kept heading to `## Memory (agentic-memory)`.
  const canonical = kept.map((line) =>
    /^## Memory\s*$/.test(line) ? "## Memory (agentic-memory)" : line,
  );

  await writeFile(claudeMdPath, canonical.join("\n"));
  log.success(`Collapsed ${blocks.length - 1} duplicate ## Memory section(s) in CLAUDE.md`);
  return true;
}
