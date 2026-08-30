import { describe, expect, it } from "vitest";
import { generateClaudeMd } from "../src/commands/init/generators/claude-md.js";
import { fixedDetectedProject } from "./fixtures/detected-project.js";

describe("generateClaudeMd regression", () => {
  it("keeps the current Claude instruction document stable", () => {
    expect(
      generateClaudeMd(
        { name: "demo", description: "" },
        fixedDetectedProject,
        { superpowers: false },
      ),
    ).toMatchInlineSnapshot(`
      "# demo

      ## Stack
      - **Framework**: Next.js
      - **Language**: TypeScript
      - **Package Manager**: pnpm

      ## Commands
      - Dev: \`pnpm dev\`
      - Build: \`pnpm build\`
      - Test: \`pnpm test:run\`
      - Lint: \`pnpm lint\`
      - Format: \`pnpm prettier --write\`

      ## Session Start
      - ALWAYS read @TASKS.md first — it tracks progress across sessions
      - Check the Session Log at the bottom of TASKS.md for where we left off
      - Update TASKS.md as you complete work

      ## Backlog
      - When a feature is discussed but deferred, add it to BACKLOG.md immediately
      - Never leave future ideas only in TASKS.md or conversation — they get lost
      - BACKLOG.md is the single source of truth for parked features
      - Every WP uses the 7-field template in BACKLOG.md — no freeform entries
      - Pull a WP into a sprint = **move**, not copy. A WP lives in exactly one file at a time

      ## Sprint Reviews
      When all tasks in the current sprint are complete, review before the closing commit:
      - Find the sprint base: \`git log --grep 'chore(sprint-' -n 1 --format=%H\`
      - Run /code-review on the diff from that base; fix all Critical and Important findings before committing
      - Run /security-review if the sprint touched auth, input handling, or dependencies
      - Run \`pnpm test:run\` and \`pnpm lint\` — must pass before the sprint-ending commit
      - If /code-review is unavailable, do a manual pass: dead code, debug logs, TODO hacks, convention violations, hardcoded values
      - For an independent second pass, dispatch the code-reviewer agent (.claude/agents/code-reviewer.md) with the base/head SHAs
      - Skip only if the sprint was trivial (docs or config-only changes)

      ## Conventions
      - Git: Conventional commits (\`feat:\`, \`fix:\`, \`docs:\`, \`refactor:\`, \`test:\`, \`chore:\`)

      ## Stop-and-Swarm
      Three failed iterations on the same problem = stop iterating alone.
      (An iteration = an attempted fix that did not change the failing symptom. Announce "Attempt N" when retrying so the count stays visible.)
      First, one systematic pass — it usually resolves the loop without the swarm:
      reproduce the failure, read the FULL error output, state one hypothesis about the root cause, and verify it BEFORE writing any fix.
      Only if that pass fails, swarm: dispatch at least 3 parallel subagents via the Task tool — in a single message so they run concurrently — each investigating from a different angle:
      1. Root-cause debug agent
      2. Upstream library/docs research agent
      3. Alternative architecture agent
      Every agent brief has four parts — agents start with empty context: Mission (one sentence), Context (exact repro command, full error text, already-failed fixes), Scope fence (files/questions NOT to touch), Return format (findings as file:line + evidence).
      Treat agent output as testimony, not truth — spot-check load-bearing claims (open the cited file, re-run the cited command) before acting on them.
      Wait for all agents to return, synthesize their findings, then act.
      For re-planning after repeated failure, switch to plan mode instead of attempting again.

      ## Off-Limits
      - Never hardcode secrets — use environment variables
      - Never write to \`.env\` files
      - Never expose internal error details in API responses

      ## Key Decisions
      <!-- Append one entry per non-obvious choice, at the moment it's made — not at sprint close: -->
      <!-- YYYY-MM-DD — Chose X over Y because Z. Revisit if W. -->
      "
    `);
  });
});
