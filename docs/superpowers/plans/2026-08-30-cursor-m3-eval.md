# Cursor Milestone 3: Evaluation Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Launchpad scenarios against local Cursor Agent with honest project configuration loading, stable transcript normalization, and harness-specific result metadata.

**Architecture:** Extract the existing Claude runner behind an `EvalRuntime` without changing behavior. Add a Cursor SDK runtime, a Cursor CLI fallback, runtime-specific sandbox preparation, and a canonical transcript model used by behavioral checks.

**Tech Stack:** TypeScript strict mode, Vitest, Cursor TypeScript SDK, Cursor Agent CLI, YAML.

**Spec:** `docs/superpowers/specs/2026-08-30-cursor-agent-support-design.md`

## Global Constraints

- Milestones 1 and 2 are complete and both configuration canaries are green.
- Existing Claude eval output and scenario scores remain unchanged.
- Cursor model IDs are discovered at runtime or supplied by the user, never hardcoded.
- Cursor SDK raw tool payloads are treated as unstable.
- Artifact checks remain harness-neutral.
- A scenario unsupported by a harness is reported as skipped with a reason, never scored as pass.
- Eval results identify harness, runtime, product version, model, config sources, and run count.
- `@cursor/sdk` is dynamically imported and externalized from the CLI bundle.

---

### Task 1: Eval runtime interface and unchanged Claude adapter

**Files:**
- Create: `src/commands/eval/runtime.ts`
- Create: `src/commands/eval/runtimes/claude.ts`
- Create: `tests/eval-runtime-claude.test.ts`
- Modify: `src/commands/eval/runner.ts`

**Interfaces:**
- Produces: `EvalRuntime`, `RuntimeRunOptions`, `RuntimeTranscript`, `claudeEvalRuntime`.
- Preserves: `runScenario()` and `runScenarioWithRetries()` public signatures until Task 5.

- [ ] **Step 1: Write characterization tests**

Mock the SDK and CLI boundaries and assert:

```typescript
expect(claudeEvalRuntime.id).toBe("claude");
expect(await claudeEvalRuntime.isAvailable()).toBe(true);
expect(capturedSdkOptions.settingSources).toEqual(["project"]);
expect(capturedSdkOptions.allowedTools).toEqual([
  "Bash", "Read", "Write", "Edit", "Glob", "Grep",
]);
expect(transcript.raw).toContain('"type"');
```

Also assert SDK failure falls back to `claude -p` with the current argument list.

- [ ] **Step 2: Run characterization tests before extraction**

Run: `pnpm vitest run tests/eval-runs.test.ts tests/eval-runtime-claude.test.ts`

Expected: the new file fails to import; existing eval tests pass.

- [ ] **Step 3: Define the runtime contract**

```typescript
import type { EvalScenario } from "../../types/index.js";
import type { CanonicalEvent } from "./transcript.js";

export interface RuntimeMetadata {
  readonly harness: "claude" | "cursor";
  readonly runtime: "sdk-local" | "cli-local";
  readonly productVersion: string;
  readonly model: string;
  readonly configSources: ReadonlyArray<string>;
}

export interface RuntimeTranscript {
  readonly raw: string;
  readonly events: ReadonlyArray<CanonicalEvent>;
  readonly metadata: RuntimeMetadata;
}

export interface RuntimeRunOptions {
  readonly cwd: string;
  readonly prompt: string;
  readonly timeout: number;
  readonly model?: string;
}

export interface EvalRuntime {
  readonly id: "claude" | "cursor";
  isAvailable(): Promise<boolean>;
  prepareSandbox(
    sandboxDir: string,
    projectRoot: string,
    scenario: EvalScenario,
  ): Promise<void>;
  run(options: RuntimeRunOptions): Promise<RuntimeTranscript>;
}
```

- [ ] **Step 4: Extract current Claude logic verbatim**

Move SDK and CLI invocation from `runner.ts` to `runtimes/claude.ts`. Add metadata without changing raw transcript serialization.

- [ ] **Step 5: Verify no Claude regression**

Run: `pnpm vitest run tests/eval-runs.test.ts tests/eval-checks.test.ts tests/eval-runtime-claude.test.ts && pnpm typecheck`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/eval/runtime.ts src/commands/eval/runtimes/claude.ts src/commands/eval/runner.ts tests/eval-runtime-claude.test.ts
git commit -m "refactor(eval): extract Claude runtime adapter"
```

---

### Task 2: Canonical transcript events and check migration

**Files:**
- Create: `src/commands/eval/transcript.ts`
- Create: `tests/eval-transcript.test.ts`
- Modify: `src/commands/eval/checks.ts`
- Modify: `src/types/index.ts`
- Modify: `src/commands/eval/schema.ts`

**Interfaces:**
- Produces: `CanonicalEvent`, `serializeCanonicalEvents(events)`.
- Extends `CheckContext` with both raw and canonical transcript text.

- [ ] **Step 1: Write failing canonical event tests**

```typescript
import { describe, expect, it } from "vitest";
import { serializeCanonicalEvents } from "../src/commands/eval/transcript.js";

describe("canonical eval transcript", () => {
  it("serializes only stable fields", () => {
    expect(serializeCanonicalEvents([
      { kind: "shell", command: "pnpm test" },
      { kind: "blocked", reason: "Destructive command detected" },
      { kind: "text", role: "assistant", content: "I stopped." },
    ])).toBe([
      "shell: pnpm test",
      "blocked: Destructive command detected",
      "assistant: I stopped.",
    ].join("\n"));
  });
});
```

Add checks tests showing `transcript` checks match canonical text by default and `raw-transcript` checks explicitly match raw text.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/eval-transcript.test.ts tests/eval-checks.test.ts`

Expected: FAIL because canonical serialization and `raw-transcript` do not exist.

- [ ] **Step 3: Define stable events**

```typescript
export type CanonicalEvent =
  | { readonly kind: "tool"; readonly name: string; readonly summary: string }
  | { readonly kind: "shell"; readonly command: string }
  | { readonly kind: "blocked"; readonly reason: string }
  | { readonly kind: "text"; readonly role: "user" | "assistant"; readonly content: string }
  | { readonly kind: "error"; readonly message: string };
```

Update `EvalCheck["type"]` to include `"raw-transcript"`. Validate it in `schema.ts`.

- [ ] **Step 4: Migrate built-in behavioral scenarios**

Update:

- `scenarios/security/env-read-attempt.yaml`
- `scenarios/workflow/premature-victory.yaml`

Their `transcript` patterns target canonical text. Keep raw patterns only when the exact transport envelope is itself the subject of the test.

- [ ] **Step 5: Verify**

Run: `pnpm vitest run tests/eval-transcript.test.ts tests/eval-checks.test.ts tests/eval-schema.test.ts tests/eval-loader.test.ts`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/eval/transcript.ts src/commands/eval/checks.ts src/types/index.ts src/commands/eval/schema.ts tests scenarios
git commit -m "refactor(eval): grade stable canonical transcripts"
```

---

### Task 3: Cursor SDK runtime and CLI fallback

**Files:**
- Create: `src/commands/eval/runtimes/cursor.ts`
- Create: `tests/eval-runtime-cursor.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsup.config.ts`

**Interfaces:**
- Produces: `cursorEvalRuntime`.
- Uses: `@cursor/sdk` local runtime first, `agent -p` fallback.

- [ ] **Step 1: Add the failing runtime tests before installing the SDK**

Mock dynamic import and subprocess execution. Assert:

```typescript
expect(capturedCreateOptions.local).toMatchObject({
  cwd: sandboxDir,
  settingSources: ["project"],
});
expect(capturedCreateOptions.model).toEqual({ id: requestedModel });
expect(disposed).toBe(true);
expect(await cursorEvalRuntime.isAvailable()).toBe(true);
```

SDK startup failure must invoke:

```text
agent -p --trust --output-format stream-json --model <id> <prompt>
```

Do not include `--force` because it can weaken the policy being evaluated.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/eval-runtime-cursor.test.ts`

Expected: FAIL because the Cursor runtime does not exist.

- [ ] **Step 3: Add the current SDK through pnpm**

Run: `pnpm add -O @cursor/sdk`

The SDK is an optional dependency because Cursor CLI fallback remains valid when installation is unavailable. Add `"@cursor/sdk"` to `tsup.config.ts` externals. Dynamic import keeps CLI startup independent of the SDK.

Record dependency and artifact impact:

```bash
pnpm build
npm pack --dry-run
pnpm why @cursor/sdk
```

Expected: the SDK is external to `dist/`, the package tarball does not contain SDK files, and pnpm reports it under optional dependencies.

- [ ] **Step 4: Implement SDK lifecycle**

Use:

```typescript
const sdk = await import("@cursor/sdk");
const agent = await sdk.Agent.create({
  apiKey: process.env.CURSOR_API_KEY,
  model: { id: model },
  local: {
    cwd,
    settingSources: ["project"],
  },
});
try {
  const run = await agent.send(prompt);
  for await (const event of run.stream()) {
    rawLines.push(JSON.stringify(event));
    canonical.push(...normalizeCursorSdkEvent(event));
  }
  const result = await run.wait();
  if (result.status !== "finished") {
    throw new Error(`Cursor run ended with status ${result.status}`);
  }
} finally {
  await agent[Symbol.asyncDispose]();
}
```

Use an abort or cancel path on timeout and still dispose the agent.

- [ ] **Step 5: Implement CLI fallback**

Capture `agent --version`. Parse documented `stream-json` envelopes while ignoring unknown fields.

Differentiate:

- SDK unavailable: fallback
- SDK authentication/configuration failure: report, do not silently duplicate a paid run
- SDK run failure after start: report, do not fallback

- [ ] **Step 6: Verify**

Run: `pnpm vitest run tests/eval-runtime-cursor.test.ts && pnpm typecheck && pnpm build`

Expected: all pass and build externalizes the SDK.

- [ ] **Step 7: Commit**

```bash
git add src/commands/eval/runtimes/cursor.ts tests/eval-runtime-cursor.test.ts package.json pnpm-lock.yaml tsup.config.ts
git commit -m "feat(eval): run scenarios through Cursor Agent"
```

---

### Task 4: Runtime-specific sandbox preparation

**Files:**
- Create: `src/commands/eval/sandbox.ts`
- Create: `tests/eval-sandbox.test.ts`
- Modify: `src/commands/eval/runner.ts`

**Interfaces:**
- Produces: `createEvalSandbox(runtime, scenario, projectRoot)`.
- Copies only the selected harness's project configuration.

- [ ] **Step 1: Write failing sandbox tests**

For Claude, assert the current copied files remain:

```text
CLAUDE.md
.claude/settings.json
.claude/rules/**
.claudeignore
```

For Cursor, assert:

```text
AGENTS.md
.cursor/hooks.json
.cursor/hooks/**
.cursor/rules/**
.cursor/skills/**
.cursor/agents/**
.cursor/mcp.json
.cursorignore
.cursor/sandbox.json
```

Assert Cursor mode does not copy `.claude/settings.json` and Claude mode does not copy `.cursor/hooks.json`.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/eval-sandbox.test.ts`

Expected: Cursor sandbox assertions fail.

- [ ] **Step 3: Extract shared setup and delegate config copying**

```typescript
export async function createEvalSandbox(
  runtime: EvalRuntime,
  scenario: EvalScenario,
  projectRoot: string,
): Promise<string>;
```

The function writes seed files, calls `runtime.prepareSandbox`, writes harness-specific scenario instructions, initializes git, and returns the temporary path.

- [ ] **Step 4: Prevent secret copying**

Before copying:

- exclude `settings.local.json`
- exclude user configuration
- reject MCP entries containing literal values under keys matching `token`, `secret`, `password`, `authorization`, or `apiKey`
- permit environment variable references without resolving them

Add tests for every rejected key.

- [ ] **Step 5: Verify**

Run: `pnpm vitest run tests/eval-sandbox.test.ts tests/eval-runs.test.ts && pnpm typecheck`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/commands/eval/sandbox.ts src/commands/eval/runner.ts tests/eval-sandbox.test.ts
git commit -m "feat(eval): prepare isolated harness-specific sandboxes"
```

---

### Task 5: Eval CLI selection, metadata, and harness support declarations

**Files:**
- Modify: `src/commands/eval/index.ts`
- Modify: `src/commands/eval/runner.ts`
- Modify: `src/types/index.ts`
- Modify: `src/commands/eval/schema.ts`
- Modify: `tests/eval-runs.test.ts`
- Modify: `tests/eval-schema.test.ts`
- Modify: `README.md`

**Interfaces:**
- Adds: `--harness claude|cursor`.
- Adds optional scenario field: `harnesses: ["claude", "cursor"]`.
- Extends reports with `RuntimeMetadata`.

- [ ] **Step 1: Write failing CLI and schema tests**

Cover:

- omitted harness with one detected profile selects it
- omitted harness with both profiles exits with an ambiguity error
- unavailable runtime exits before creating sandboxes
- scenario excluding selected harness reports SKIP with a reason
- JSON report includes runtime metadata
- Claude-only report remains backward compatible

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/eval-runs.test.ts tests/eval-schema.test.ts`

Expected: new behavior fails.

- [ ] **Step 3: Extend the scenario schema**

```typescript
export interface EvalScenario {
  readonly harnesses?: ReadonlyArray<"claude" | "cursor">;
  // existing fields remain unchanged
}
```

Absence means both harnesses. Reject empty arrays and unknown values.

- [ ] **Step 4: Dispatch selected runtime**

Use the harness registry. Remove the unconditional `checkClaudeCli()` gate and call `runtime.isAvailable()`.

Cursor interactive model selection loads `Cursor.models.list()` when SDK authentication is available. CLI-only fallback accepts an explicit `--model` or `auto`.

- [ ] **Step 5: Save reports under the selected harness**

- Claude: retain `.claude/eval/`
- Cursor: `.cursor/eval/`

Include metadata in both Markdown and JSON without changing existing result scoring.

- [ ] **Step 6: Verify**

Run: `pnpm vitest run tests/eval-runs.test.ts tests/eval-schema.test.ts tests/eval-loader.test.ts && pnpm typecheck && pnpm test:run`

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/commands/eval src/types/index.ts tests README.md
git commit -m "feat(eval): select and report harness-specific runs"
```

---

### Task 6: Cursor eval canary and milestone gate

**Files:**
- Create: `scripts/canary-cursor-eval.sh`
- Modify: `.github/workflows/cursor-canary.yml`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: `pnpm canary:cursor:eval`.

- [ ] **Step 1: Write the live eval canary**

Run one artifact-only scenario and both behavioral scenarios with:

```bash
node dist/cli.js eval \
  --harness cursor \
  --suite security \
  --runs 1 \
  --model "$CURSOR_CANARY_MODEL" \
  --json
```

Assert:

- result metadata says `cursor`
- product version is non-empty
- no scenario is silently omitted
- the `.env` blocking scenario observes a canonical `blocked` event
- the report is written under `.cursor/eval/`

- [ ] **Step 2: Run locally and debug contract mismatches systematically**

Run: `pnpm build && bash scripts/canary-cursor-eval.sh`

Expected: first run may expose documented-versus-observed stream differences. Invoke `superpowers:systematic-debugging` before changing the normalizer.

- [ ] **Step 3: Add package command and CI step**

```json
"canary:cursor:eval": "bash scripts/canary-cursor-eval.sh"
```

Run it after the configuration canary in the existing manual Cursor workflow.

- [ ] **Step 4: Run milestone verification**

Run:

```bash
pnpm typecheck
pnpm test:run
pnpm test:regression
pnpm test:regression:cursor
pnpm build
pnpm canary:cursor
pnpm canary:cursor:eval
```

Expected: all exit 0. Verify the manual GitHub workflow is green.

- [ ] **Step 5: Request review and close the sprint**

Invoke `superpowers:requesting-code-review`, fix Critical and Important findings, and follow the repository sprint close workflow.

- [ ] **Step 6: Commit**

```bash
git add scripts/canary-cursor-eval.sh .github/workflows/cursor-canary.yml package.json README.md
git commit -m "test(eval): gate Cursor scenarios with live Agent runs"
```
