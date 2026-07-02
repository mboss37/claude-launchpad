import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../../lib/output.js";
import { fileExists } from "../../lib/fs-utils.js";
import { generateWorkflowRule } from "../init/generators/workflow-rule.js";
import { generateHooksRule } from "../init/generators/hooks-rule.js";
import { generateReviewerAgent } from "../init/generators/agent-reviewer.js";
import { STALE_SWARM_PHRASE, SWARM_PHRASE_REPLACEMENT } from "../../lib/sections.js";

export async function createWorkflowRule(root: string): Promise<boolean> {
  const rulesDir = join(root, ".claude", "rules");
  const workflowPath = join(rulesDir, "workflow.md");
  if (await fileExists(workflowPath)) return false;

  await mkdir(rulesDir, { recursive: true });
  await writeFile(workflowPath, generateWorkflowRule());
  log.success("Created .claude/rules/workflow.md (path-scoped BACKLOG/TASKS workflow rules)");
  return true;
}

export async function createReviewerAgent(root: string): Promise<boolean> {
  const agentsDir = join(root, ".claude", "agents");
  const agentPath = join(agentsDir, "code-reviewer.md");
  if (await fileExists(agentPath)) return false;

  await mkdir(agentsDir, { recursive: true });
  await writeFile(agentPath, generateReviewerAgent());
  log.success("Created .claude/agents/code-reviewer.md (fresh-context independent reviewer)");
  return true;
}

/** Overwrite a versioned, launchpad-authored workflow.md with the latest template. */
export async function updateWorkflowRule(root: string): Promise<boolean> {
  const workflowPath = join(root, ".claude", "rules", "workflow.md");
  const content = await readFile(workflowPath, "utf-8").catch(() => null);
  if (content === null) return false;
  // Only overwrite files carrying our version marker — never user-authored rules.
  if (!/<!-- lp-workflow-version: \d+ -->/.test(content)) return false;

  await writeFile(workflowPath, generateWorkflowRule());
  log.success("Updated .claude/rules/workflow.md to the latest version");
  return true;
}

/** Replace the known-stale 'Agent tool' phrase in CLAUDE.md; custom content is left alone. */
export async function fixStaleSwarmPhrase(root: string): Promise<boolean> {
  const claudeMdPath = join(root, "CLAUDE.md");
  const content = await readFile(claudeMdPath, "utf-8").catch(() => null);
  if (content === null || !content.includes(STALE_SWARM_PHRASE)) return false;

  await writeFile(claudeMdPath, content.replaceAll(STALE_SWARM_PHRASE, SWARM_PHRASE_REPLACEMENT));
  log.success("Modernized Stop-and-Swarm wording (Agent tool → Task tool subagents)");
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
