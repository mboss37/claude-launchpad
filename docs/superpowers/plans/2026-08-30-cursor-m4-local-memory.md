# Cursor Milestone 4: Local Memory Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing agentic-memory SQLite/MCP engine to local Cursor Agent with native MCP configuration, Cursor hook envelopes, truthful installation detection, and benchmark-gated behavior.

**Architecture:** Leave storage, ranking, decay, sync, dashboard, and MCP tools unchanged. Extract the Claude-specific install wiring behind a memory harness adapter, then add a Cursor implementation for `.cursor/mcp.json`, `AGENTS.md`, and local lifecycle hooks.

**Tech Stack:** TypeScript strict mode, Vitest, SQLite/FTS5, stdio MCP, Cursor hooks, bash, jq.

**Spec:** `docs/superpowers/specs/2026-08-30-cursor-agent-support-design.md`

## Global Constraints

- Milestones 1 through 3 are complete.
- Cursor memory support is local-only in this milestone.
- Never require the `claude` CLI for `--harness cursor`.
- Never write Claude permission keys into Cursor files.
- Existing memory database format and seven MCP tools remain unchanged.
- Existing 59 memory benchmarks must pass before completion.
- A `sessionEnd` auto-push is shipped only if a live canary proves the process completes after Cursor exits.
- If lifecycle proof fails, document manual `memory sync` and omit the unreliable hook.

---

### Task 1: Memory harness adapter and unchanged Claude implementation

**Files:**
- Create: `src/commands/memory/harness/types.ts`
- Create: `src/commands/memory/harness/claude.ts`
- Create: `tests/memory/harness-claude.test.ts`
- Modify: `src/commands/memory/subcommands/install.ts`
- Modify: `src/lib/memory-registration.ts`

**Interfaces:**
- Produces: `MemoryHarnessAdapter`, `MemoryInstallContext`, `claudeMemoryAdapter`.
- Preserves all existing Claude installation behavior.

- [ ] **Step 1: Write characterization tests**

Mock settings and subprocess boundaries, then assert the Claude adapter:

```typescript
expect(claudeMemoryAdapter.id).toBe("claude");
expect(await claudeMemoryAdapter.isAvailable()).toBe(true);
expect(registerCommand).toContain("claude mcp add --scope project");
expect(settings.autoMemoryEnabled).toBe(false);
expect(settings.hooks.SessionStart).toBeDefined();
expect(settings.hooks.SessionEnd).toBeDefined();
expect(settings.permissions.allow).toContain(
  "mcp__agentic-memory__memory_search",
);
```

- [ ] **Step 2: Run characterization tests**

Run: `pnpm vitest run tests/memory/harness-claude.test.ts tests/memory-install-dedup.test.ts`

Expected: the new adapter import fails while existing tests pass.

- [ ] **Step 3: Define the adapter**

```typescript
import type { HarnessId } from "../../../harness/types.js";
import type { MemoryPlacement } from "../../../types/index.js";

export interface MemoryInstallContext {
  readonly projectRoot: string;
  readonly placement: MemoryPlacement;
  readonly command: ReadonlyArray<string>;
}

export interface MemoryHarnessAdapter {
  readonly id: HarnessId;
  isAvailable(): Promise<boolean>;
  isInstalled(projectRoot: string): Promise<boolean>;
  configureProject(context: MemoryInstallContext): Promise<void>;
  registerMcp(context: MemoryInstallContext): Promise<boolean>;
  installGuidance(context: MemoryInstallContext): Promise<boolean>;
}
```

- [ ] **Step 4: Extract Claude wiring without changing behavior**

Move from `install.ts`:

- Claude CLI preflight
- settings hooks and permissions
- `allowedMcpServers`
- `claude mcp add/list`
- CLAUDE.md guidance
- Claude registration detection

Keep database setup, dependency setup, sync guidance, and shared output in `runInstall()`.

- [ ] **Step 5: Verify**

Run: `pnpm vitest run tests/memory/harness-claude.test.ts tests/memory-install-dedup.test.ts tests/memory-analyzer.test.ts && pnpm typecheck && pnpm test:run`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/memory/harness src/commands/memory/subcommands/install.ts src/lib/memory-registration.ts tests/memory/harness-claude.test.ts
git commit -m "refactor(memory): extract Claude installation adapter"
```

---

### Task 2: Harness-specific memory context envelopes

**Files:**
- Create: `src/commands/memory/context-format.ts`
- Create: `tests/memory/context-format.test.ts`
- Modify: `src/commands/memory/subcommands/context.ts`
- Modify: `src/commands/memory/index.ts`
- Modify: `tests/memory/context-json.test.ts`

**Interfaces:**
- Produces: `ContextFormat = "plain" | "claude" | "cursor"`, `formatMemoryContext(content, format)`.
- CLI: `memory context --format <plain|claude|cursor>`.
- Compatibility: existing `--json` remains an alias for `--format claude` during this release.

- [ ] **Step 1: Write failing format tests**

```typescript
import { describe, expect, it } from "vitest";
import { formatMemoryContext } from "../../src/commands/memory/context-format.js";

describe("memory context formats", () => {
  it("formats Claude SessionStart output", () => {
    expect(JSON.parse(formatMemoryContext("remember this", "claude"))).toEqual({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "remember this",
      },
    });
  });

  it("formats Cursor sessionStart output", () => {
    expect(JSON.parse(formatMemoryContext("remember this", "cursor"))).toEqual({
      additional_context: "remember this",
    });
  });

  it("returns unwrapped text in plain mode", () => {
    expect(formatMemoryContext("remember this", "plain")).toBe("remember this");
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/memory/context-format.test.ts tests/memory/context-json.test.ts`

Expected: FAIL because the formatter does not exist.

- [ ] **Step 3: Implement pure formatting**

```typescript
export type ContextFormat = "plain" | "claude" | "cursor";

export function formatMemoryContext(
  content: string,
  format: ContextFormat,
): string {
  if (format === "plain") return content;
  if (format === "cursor") {
    return JSON.stringify({ additional_context: content });
  }
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: content,
    },
  });
}
```

- [ ] **Step 4: Add CLI validation and compatibility**

Reject unknown values with:

```text
Context format must be one of: plain, claude, cursor
```

When both `--json` and `--format` are supplied, reject conflicting choices rather than guessing.

- [ ] **Step 5: Verify**

Run: `pnpm vitest run tests/memory/context-format.test.ts tests/memory/context-json.test.ts && pnpm typecheck`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/memory/context-format.ts src/commands/memory/subcommands/context.ts src/commands/memory/index.ts tests/memory/context-format.test.ts tests/memory/context-json.test.ts
git commit -m "feat(memory): emit Claude and Cursor context envelopes"
```

---

### Task 3: Cursor MCP registration, guidance, and installation detection

**Files:**
- Create: `src/commands/memory/harness/cursor.ts`
- Create: `tests/memory/harness-cursor.test.ts`
- Modify: `src/harness/cursor/merge.ts`
- Modify: `src/commands/memory/index.ts`

**Interfaces:**
- Produces: `cursorMemoryAdapter`, `createCursorMemoryAdapter(dependencies)`.
- Writes: `.cursor/mcp.json`, `AGENTS.md`.

- [ ] **Step 1: Write failing adapter tests**

```typescript
let root: string;
let context: MemoryInstallContext;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "lp-cursor-memory-"));
  context = {
    projectRoot: root,
    placement: "shared",
    command: ["npx", "claude-launchpad", "memory", "serve"],
  };
});

async function writeJson(
  rootDir: string,
  relativePath: string,
  value: Record<string, unknown>,
): Promise<void> {
  const path = join(rootDir, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
}

async function readJson(
  rootDir: string,
  relativePath: string,
): Promise<{ readonly mcpServers: Record<string, unknown> }> {
  return JSON.parse(
    await readFile(join(rootDir, relativePath), "utf-8"),
  ) as { readonly mcpServers: Record<string, unknown> };
}

async function seedCursorMemoryMcp(rootDir: string): Promise<void> {
  await writeJson(rootDir, ".cursor/mcp.json", {
    mcpServers: {
      "agentic-memory": {
        command: "npx",
        args: ["claude-launchpad", "memory", "serve"],
      },
    },
  });
}

async function seedCursorMemoryContextHook(rootDir: string): Promise<void> {
  await writeJson(rootDir, ".cursor/hooks.json", {
    version: 1,
    hooks: {
      sessionStart: [{
        command: "npx claude-launchpad memory context --format cursor",
      }],
    },
  });
}

it("installs without a Claude CLI", async () => {
  const adapter = createCursorMemoryAdapter({
    commandExists: async (command) => command === "agent",
  });
  expect(await adapter.isAvailable()).toBe(true);
  await adapter.configureProject(context);
  expect(await readJson(root, ".cursor/mcp.json")).toMatchObject({
    mcpServers: {
      "agentic-memory": {
        command: "npx",
        args: ["claude-launchpad", "memory", "serve"],
      },
    },
  });
});

it("preserves existing MCP servers", async () => {
  await writeJson(root, ".cursor/mcp.json", {
    mcpServers: { custom: { url: "https://example.test/mcp" } },
  });
  await cursorMemoryAdapter.registerMcp(context);
  const config = await readJson(root, ".cursor/mcp.json");
  expect(Object.keys(config.mcpServers)).toEqual(["custom", "agentic-memory"]);
});

it("detects installation only when MCP and context hook both exist", async () => {
  await seedCursorMemoryMcp(root);
  expect(await cursorMemoryAdapter.isInstalled(root)).toBe(false);
  await seedCursorMemoryContextHook(root);
  expect(await cursorMemoryAdapter.isInstalled(root)).toBe(true);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/memory/harness-cursor.test.ts`

Expected: FAIL because the Cursor adapter does not exist.

- [ ] **Step 3: Implement native MCP configuration**

Write:

```json
{
  "mcpServers": {
    "agentic-memory": {
      "command": "npx",
      "args": ["claude-launchpad", "memory", "serve"]
    }
  }
}
```

Use the shared immutable merger. Do not shell out to an undocumented registration command.

- [ ] **Step 4: Add Cursor guidance**

Append one marked `## Memory (agentic-memory)` section to `AGENTS.md`. Guidance names the seven tools without Claude `mcp__...` permission syntax and states that automatic injection is local-only.

Never overwrite an existing memory section. If an unmarked section exists, report it and leave it unchanged.

- [ ] **Step 5: Implement honest detection**

Installation requires:

- `agentic-memory` in `.cursor/mcp.json`
- a Cursor `sessionStart` hook whose command is exactly `npx claude-launchpad memory context --format cursor`
- the memory database can be opened and migrated

- [ ] **Step 6: Verify**

Run: `pnpm vitest run tests/memory/harness-cursor.test.ts tests/cursor-merge.test.ts && pnpm typecheck`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/commands/memory/harness/cursor.ts src/harness/cursor/merge.ts src/commands/memory/index.ts tests/memory/harness-cursor.test.ts
git commit -m "feat(memory): register agentic memory with Cursor"
```

---

### Task 4: Cursor local lifecycle hooks and memory doctor

**Files:**
- Create: `src/commands/memory/harness/cursor-hooks.ts`
- Create: `tests/memory/cursor-hooks.test.ts`
- Modify: `src/commands/doctor/analyzers/memory.ts`
- Modify: `src/commands/doctor/fixer-memory.ts`
- Modify: `tests/memory-analyzer.test.ts`

**Interfaces:**
- Produces: `buildCursorMemoryHooks(includeSessionEndPush)`.
- Extends memory analyzer to dispatch by harness.

- [ ] **Step 1: Write failing hook tests**

```typescript
expect(buildCursorMemoryHooks(false)).toMatchObject({
  sessionStart: [
    {
      command: "npx claude-launchpad memory pull -y",
    },
    {
      command: "npx claude-launchpad memory context --format cursor",
    },
  ],
});

expect(buildCursorMemoryHooks(false).sessionEnd).toBeUndefined();
expect(buildCursorMemoryHooks(true).sessionEnd?.[0]).toMatchObject({
  command: "npx claude-launchpad memory push -y",
});
```

Add analyzer tests for missing MCP, missing context hook, stale `--json` Claude envelope, and unsupported Cloud memory claims.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/memory/cursor-hooks.test.ts tests/memory-analyzer.test.ts`

Expected: FAIL because Cursor memory hooks are not implemented.

- [ ] **Step 3: Install start hooks only**

Merge into `.cursor/hooks.json`:

- `sessionStart` pull
- `sessionStart` context with `--format cursor`

Do not install `sessionEnd` yet. The live lifecycle proof in Task 5 controls that capability.

- [ ] **Step 4: Make doctor harness-aware**

Cursor memory checks inspect:

- `.cursor/mcp.json`
- `.cursor/hooks.json`
- AGENTS.md guidance
- database health
- helper executable availability

Claude memory checks remain unchanged.

- [ ] **Step 5: Verify**

Run: `pnpm vitest run tests/memory/cursor-hooks.test.ts tests/memory-analyzer.test.ts tests/memory-install-dedup.test.ts && pnpm typecheck`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/memory/harness/cursor-hooks.ts src/commands/doctor/analyzers/memory.ts src/commands/doctor/fixer-memory.ts tests/memory/cursor-hooks.test.ts tests/memory-analyzer.test.ts
git commit -m "feat(memory): add Cursor context injection and diagnostics"
```

---

### Task 5: Live Cursor memory lifecycle proof

**Files:**
- Create: `scripts/canary-cursor-memory.sh`
- Modify: `src/commands/memory/harness/cursor-hooks.ts`
- Modify: `tests/memory/cursor-hooks.test.ts`
- Modify: `.github/workflows/cursor-canary.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm canary:cursor:memory`.
- Decides with evidence whether `sessionEnd` push is enabled.

- [ ] **Step 1: Write the canary**

The canary uses an isolated `AGENTIC_MEMORY_HOME` and fake private Gist transport fixture. It:

1. initializes Cursor memory
2. seeds one memory
3. starts a real Cursor Agent session
4. verifies injected context appears at session start
5. stores a second memory through MCP
6. ends the Cursor session
7. waits up to the documented hook timeout
8. verifies the push transport received both memories

No real user database or Gist is read or written.

- [ ] **Step 2: Run the canary without `sessionEnd` enabled**

Run: `pnpm build && bash scripts/canary-cursor-memory.sh`

Expected: context injection and MCP storage pass; automatic push is reported as intentionally absent.

- [ ] **Step 3: Test `sessionEnd` push in an experimental fixture**

Add the hook only inside the canary fixture and run the original process-exit reproduction three times.

Enable `sessionEnd` in the product only if all three runs prove:

- hook starts
- push process survives session closure
- transport completes
- Cursor CLI exits without hanging

If any run fails, keep `buildCursorMemoryHooks(false)` in production and document manual `memory sync`.

- [ ] **Step 4: Encode the verified outcome**

If proven, change installer use to:

```typescript
buildCursorMemoryHooks(true);
```

If not proven, retain:

```typescript
buildCursorMemoryHooks(false);
```

Add the corresponding exact test and user-facing output.

- [ ] **Step 5: Add CI and package command**

```json
"canary:cursor:memory": "bash scripts/canary-cursor-memory.sh"
```

Add it to the manual Cursor canary workflow after configuration and eval.

- [ ] **Step 6: Commit**

```bash
git add scripts/canary-cursor-memory.sh src/commands/memory/harness/cursor-hooks.ts tests/memory/cursor-hooks.test.ts .github/workflows/cursor-canary.yml package.json
git commit -m "test(memory): prove Cursor lifecycle integration"
```

---

### Task 6: Benchmark, regression, documentation, and milestone gate

**Files:**
- Modify: `README.md`
- Modify: `docs/content/docs/memory.mdx`
- Modify: `tests/regression/cursor-doctor-regression.sh`
- Modify: `CHANGELOG.md` only if this milestone is selected for release

**Interfaces:**
- No new runtime interface.

- [ ] **Step 1: Add regression cases**

Verify:

- cursor-only install succeeds without `claude`
- repeated install is idempotent
- custom Cursor MCP and hooks survive
- doctor detects healthy memory
- `--format cursor` emits valid `additional_context`
- Cursor Cloud invocation returns an explicit unsupported message

- [ ] **Step 2: Update documentation**

Document:

- local Cursor support
- exact generated files
- manual `memory sync` if sessionEnd was not proven
- Cursor Cloud exclusion
- database location and cross-device Gist behavior

- [ ] **Step 3: Run memory benchmark gate**

Run: `pnpm bench:memory`

Expected: all 59 benchmarks pass with no threshold changes. A threshold change requires a separate reviewed algorithm decision and is outside this adapter milestone.

- [ ] **Step 4: Run complete verification**

Run:

```bash
pnpm typecheck
pnpm test:run
pnpm test:regression
pnpm test:regression:cursor
pnpm bench:memory
pnpm build
pnpm canary:cursor
pnpm canary:cursor:eval
pnpm canary:cursor:memory
```

Expected: all exit 0. Verify the manual GitHub Cursor canary workflow is green.

- [ ] **Step 5: Request review and close the sprint**

Invoke `superpowers:requesting-code-review`, fix Critical and Important findings, and follow the repository sprint close workflow.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/content/docs/memory.mdx tests/regression/cursor-doctor-regression.sh
git commit -m "docs(memory): document local Cursor Agent support"
```
