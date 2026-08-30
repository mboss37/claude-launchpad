# Cursor Milestone 2: Deterministic Fixers and Live Canary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe, idempotent `doctor --fix` support for Launchpad-managed Cursor files and prove the generated policy works in a real Cursor Agent run.

**Architecture:** Keep Cursor repairs in a separate intent-keyed fix table. JSON mergers preserve unrelated hooks and settings; versioned text fixers rewrite only files carrying Launchpad markers. Generated hooks use stable command paths as identity because Cursor's public hook schema has no `id` field. A live canary validates behavior through Cursor Agent rather than inferring correctness from generated JSON.

**Tech Stack:** TypeScript strict mode, Vitest, bash, jq, Cursor Agent CLI.

**Spec:** `docs/superpowers/specs/2026-08-30-cursor-agent-support-design.md`

## Global Constraints

- Milestone 1 is complete and its Claude and Cursor regression suites are green.
- Never dispatch a Cursor issue into the Claude FIX_TABLE.
- Never overwrite unmarked user-authored files.
- Merge hook arrays by stable generated command path, preserving unrelated entries and order.
- Security hooks use `failClosed: true`.
- A fix returns `true` only when bytes on disk changed.
- Three fixed-point passes remain the upper bound.
- No release claim until the live Cursor canary passes against a recorded Cursor version.

---

### Task 1: Safe Cursor JSON and versioned-text mergers

**Files:**
- Create: `src/harness/cursor/merge.ts`
- Create: `tests/cursor-merge.test.ts`

**Interfaces:**
- Produces: `mergeCursorHooks(existing, generated)`, `mergeCursorMcp(existing, generated)`, `replaceVersionedCursorFile(existing, generated, markerPrefix)`.
- Consumed by: Cursor fixers and the memory adapter.

- [ ] **Step 1: Write failing merge tests**

```typescript
import { describe, expect, it } from "vitest";
import {
  mergeCursorHooks,
  mergeCursorMcp,
  replaceVersionedCursorFile,
} from "../src/harness/cursor/merge.js";

describe("Cursor config mergers", () => {
  it("preserves unrelated hooks and replaces a Launchpad hook by command path", () => {
    const existing = {
      version: 1,
      hooks: {
        beforeShellExecution: [
          { command: "./custom-audit.sh" },
          {
            command: ".cursor/hooks/destructive-shell.sh",
            failClosed: false,
          },
        ],
      },
    };
    const generated = {
      version: 1,
      hooks: {
        beforeShellExecution: [
          {
            command: ".cursor/hooks/destructive-shell.sh",
            failClosed: true,
          },
        ],
      },
    };
    expect(mergeCursorHooks(existing, generated)).toEqual({
      version: 1,
      hooks: {
        beforeShellExecution: [
          { command: "./custom-audit.sh" },
          {
            command: ".cursor/hooks/destructive-shell.sh",
            failClosed: true,
          },
        ],
      },
    });
  });

  it("merges MCP servers by name without deleting custom servers", () => {
    expect(mergeCursorMcp(
      { mcpServers: { custom: { url: "https://example.test/mcp" } } },
      { mcpServers: { "agentic-memory": { command: "npx", args: ["claude-launchpad", "memory", "serve"] } } },
    )).toMatchObject({
      mcpServers: { custom: {}, "agentic-memory": {} },
    });
  });

  it("rewrites marked files and refuses unmarked files", () => {
    const generated = "# Current\n<!-- lp-cursor-rule-version: 2 -->\n";
    expect(replaceVersionedCursorFile(
      "# Old\n<!-- lp-cursor-rule-version: 1 -->\n",
      generated,
      "lp-cursor-rule-version",
    )).toBe(generated);
    expect(replaceVersionedCursorFile(
      "# User-authored\n",
      generated,
      "lp-cursor-rule-version",
    )).toBeNull();
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/cursor-merge.test.ts`

Expected: FAIL because the merger does not exist.

- [ ] **Step 3: Implement immutable mergers**

Use these signatures:

```typescript
export function mergeCursorHooks(
  existing: Record<string, unknown>,
  generated: Record<string, unknown>,
): Record<string, unknown>;

export function mergeCursorMcp(
  existing: Record<string, unknown>,
  generated: Record<string, unknown>,
): Record<string, unknown>;

export function replaceVersionedCursorFile(
  existing: string,
  generated: string,
  markerPrefix: string,
): string | null;
```

Reject malformed hook arrays rather than coercing them. Preserve unknown top-level keys.

- [ ] **Step 4: Verify**

Run: `pnpm vitest run tests/cursor-merge.test.ts && pnpm typecheck`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/harness/cursor/merge.ts tests/cursor-merge.test.ts
git commit -m "feat(cursor): add non-destructive config mergers"
```

---

### Task 2: Cursor fixer registry and versioned file repair

**Files:**
- Create: `src/harness/cursor/fixer.ts`
- Create: `src/harness/cursor/fixers/files.ts`
- Create: `tests/cursor-fixer.test.ts`

**Interfaces:**
- Produces: `applyCursorFixes(issues, root): Promise<FixResult>`.
- Produces file fixers: `createOrUpdateCursorRule`, `createCursorIgnore`, `createCursorAgent`, `createCursorSkill`.

- [ ] **Step 1: Write failing file-fixer tests**

```typescript
async function createCursorFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "lp-cursor-fixer-"));
  await mkdir(join(root, ".cursor"), { recursive: true });
  await writeFile(join(root, "AGENTS.md"), "# Demo\n");
  return root;
}

async function writeFixture(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const path = join(root, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function readFixture(
  root: string,
  relativePath: string,
): Promise<string> {
  return readFile(join(root, relativePath), "utf-8");
}

it("creates a missing verification rule and is idempotent", async () => {
  const root = await createCursorFixture();
  const issue = cursorIssue("Rules", "No .cursor/rules/verification.mdc");
  expect(await applyCursorFixes([issue], root)).toEqual({ fixed: 1, skipped: 0 });
  expect(await applyCursorFixes([issue], root)).toEqual({ fixed: 0, skipped: 1 });
});

it("updates an outdated marked rule", async () => {
  const root = await createCursorFixture();
  await writeFixture(root, ".cursor/rules/verification.mdc", [
    "---",
    "description: Old",
    "alwaysApply: true",
    "---",
    "<!-- lp-cursor-verification-version: 0 -->",
  ].join("\n"));
  const issue = cursorIssue("Rules", "verification.mdc rule is outdated");
  expect((await applyCursorFixes([issue], root)).fixed).toBe(1);
});

it("does not overwrite an unmarked user rule", async () => {
  const root = await createCursorFixture();
  await writeFixture(root, ".cursor/rules/verification.mdc", "# My policy\n");
  const issue = cursorIssue("Rules", "verification.mdc rule is outdated");
  expect(await applyCursorFixes([issue], root)).toEqual({ fixed: 0, skipped: 1 });
  expect(await readFixture(root, ".cursor/rules/verification.mdc")).toBe("# My policy\n");
});
```

Define local test helpers in the same file:

```typescript
function cursorIssue(analyzer: string, message: string): DiagnosticIssue {
  return { analyzer, message, severity: "medium", fix: "Run doctor --fix" };
}
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/cursor-fixer.test.ts`

Expected: FAIL because `applyCursorFixes` does not exist.

- [ ] **Step 3: Implement an intent-keyed table**

```typescript
type CursorFix = (root: string) => Promise<boolean>;

const CURSOR_FIXES: ReadonlyArray<{
  readonly analyzer: string;
  readonly match: string;
  readonly fix: CursorFix;
}> = [
  {
    analyzer: "Rules",
    match: "No .cursor/rules/verification.mdc",
    fix: createVerificationRule,
  },
  {
    analyzer: "Rules",
    match: "verification.mdc rule is outdated",
    fix: updateVerificationRule,
  },
  {
    analyzer: "Security",
    match: ".env is missing from .cursorignore",
    fix: addEnvToCursorIgnore,
  },
];
```

Add entries for every deterministic Milestone 1 finding. Leave environment-dependent sandbox advice without a fixer.

- [ ] **Step 4: Verify fixed-point behavior**

Add a test where creating `.cursor/hooks.json` unlocks a second finding for a missing script. Run through the doctor loop and assert both are fixed within three passes.

Run: `pnpm vitest run tests/cursor-fixer.test.ts && pnpm typecheck`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/harness/cursor/fixer.ts src/harness/cursor/fixers tests/cursor-fixer.test.ts
git commit -m "feat(cursor): repair versioned project files safely"
```

---

### Task 3: Cursor hooks and script repair

**Files:**
- Create: `src/harness/cursor/fixers/hooks.ts`
- Create: `tests/cursor-hook-fixer.test.ts`
- Modify: `src/harness/cursor/generators.ts`

**Interfaces:**
- Produces: `createOrMergeCursorHooks(root, detected)`, `refreshCursorHookScripts(root, detected)`.
- Consumes: mergers from Task 1 and generated hook definitions from Milestone 1.

- [ ] **Step 1: Write failing tests**

```typescript
const detected: DetectedProject = {
  name: "demo",
  language: "TypeScript",
  framework: null,
  packageManager: "pnpm",
  hasTests: true,
  hasLinter: true,
  hasFormatter: true,
  formatCommand: "pnpm prettier --write",
  lintCommand: "pnpm lint",
  testCommand: "pnpm test:run",
  devCommand: "pnpm dev",
  buildCommand: "pnpm build",
};

async function writeHooks(
  root: string,
  hooks: Record<string, unknown>,
): Promise<void> {
  await mkdir(join(root, ".cursor"), { recursive: true });
  await writeFile(
    join(root, ".cursor", "hooks.json"),
    JSON.stringify({ version: 1, hooks }, null, 2) + "\n",
  );
}

it("adds Launchpad hooks without deleting custom hooks", async () => {
  const root = await mkdtemp(join(tmpdir(), "lp-cursor-hooks-"));
  await writeHooks(root, {
    afterFileEdit: [{ command: "./custom-audit.sh" }],
  });
  expect(await createOrMergeCursorHooks(root, detected)).toBe(true);
  const parsed = JSON.parse(
    await readFile(join(root, ".cursor", "hooks.json"), "utf-8"),
  );
  expect(parsed.hooks.afterFileEdit[0]).toEqual({
    command: "./custom-audit.sh",
  });
});

it("sets failClosed on both security hooks", async () => {
  const root = await mkdtemp(join(tmpdir(), "lp-cursor-security-hooks-"));
  await writeHooks(root, {
    beforeReadFile: [{
      command: ".cursor/hooks/env-read.sh",
      failClosed: false,
    }],
    beforeShellExecution: [{
      command: ".cursor/hooks/destructive-shell.sh",
      failClosed: false,
    }],
  });
  expect(await createOrMergeCursorHooks(root, detected)).toBe(true);
  const parsed = JSON.parse(
    await readFile(join(root, ".cursor", "hooks.json"), "utf-8"),
  );
  expect(parsed.hooks.beforeReadFile[0].failClosed).toBe(true);
  expect(parsed.hooks.beforeShellExecution[0].failClosed).toBe(true);
});

it("refreshes only Launchpad-owned scripts", async () => {
  const root = await mkdtemp(join(tmpdir(), "lp-cursor-scripts-"));
  const hooksDir = join(root, ".cursor", "hooks");
  await mkdir(hooksDir, { recursive: true });
  await writeFile(
    join(hooksDir, "env-read.sh"),
    "#!/bin/bash\n# lp-cursor-hook-version: 0\nexit 0\n",
  );
  await writeFile(
    join(hooksDir, "custom.sh"),
    "#!/bin/bash\necho custom\n",
  );
  expect(await refreshCursorHookScripts(root, detected)).toBe(true);
  expect(await readFile(join(hooksDir, "env-read.sh"), "utf-8")).toContain(
    "lp-cursor-hook-version: 1",
  );
  expect(await readFile(join(hooksDir, "custom.sh"), "utf-8")).toBe(
    "#!/bin/bash\necho custom\n",
  );
});

it("makes generated scripts executable", async () => {
  const root = await mkdtemp(join(tmpdir(), "lp-cursor-modes-"));
  expect(await refreshCursorHookScripts(root, detected)).toBe(true);
  const info = await stat(join(root, ".cursor", "hooks", "env-read.sh"));
  expect(info.mode & 0o111).not.toBe(0);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/cursor-hook-fixer.test.ts`

Expected: FAIL because hook fixers do not exist.

- [ ] **Step 3: Implement hook identity and script markers**

Every generated hook has a stable command path:

```text
.cursor/hooks/env-read.sh
.cursor/hooks/destructive-shell.sh
.cursor/hooks/auto-format.sh
.cursor/hooks/workflow-check.sh
.cursor/hooks/sprint-open.sh
.cursor/hooks/session-context.sh
```

Match and replace only an existing object whose `command` equals the generated command path. Unknown objects and commands stay in their original order. Never emit an undocumented `id` key.

Every generated script starts after its shebang with:

```bash
# lp-cursor-hook-version: 1
```

Cursor hooks consume direct Cursor fields. Shared policy functions may emit script bodies, but do not hide dialect differences behind brittle jq expressions.

- [ ] **Step 4: Wire issues to `CURSOR_FIXES`**

Add exact table matches for:

- no hooks configured
- missing `.env` read protection
- missing destructive-shell protection
- security hook not fail-closed
- missing auto-format
- missing workflow check
- missing session context
- missing or stale Launchpad hook script

- [ ] **Step 5: Verify**

Run: `pnpm vitest run tests/cursor-hook-fixer.test.ts tests/cursor-doctor.test.ts && pnpm typecheck`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/harness/cursor/fixers/hooks.ts src/harness/cursor/generators.ts src/harness/cursor/fixer.ts tests/cursor-hook-fixer.test.ts
git commit -m "feat(cursor): repair hooks and security policy"
```

---

### Task 4: Enable `doctor --fix` for Cursor and both mode

**Files:**
- Modify: `src/commands/doctor/index.ts`
- Modify: `tests/cursor-doctor.test.ts`
- Modify: `tests/fixer.test.ts`

**Interfaces:**
- Consumes: `applyCursorFixes()`.
- Preserves: existing `applyFixes()` for Claude.

- [ ] **Step 1: Replace the Milestone 1 rejection test**

Add tests proving:

- Cursor-only `--fix` dispatches only to `applyCursorFixes`
- Claude-only `--fix` dispatches only to `applyFixes`
- both mode fixes both reports independently
- dry-run lists Cursor fixes without writing
- malformed Cursor JSON is skipped with an actionable message

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/cursor-doctor.test.ts tests/fixer.test.ts`

Expected: the old "not available yet" behavior fails the new Cursor tests.

- [ ] **Step 3: Add harness-specific fixed-point loops**

Extract:

```typescript
interface FixStrategy {
  readonly harness: HarnessId;
  apply(issues: ReadonlyArray<DiagnosticIssue>, root: string): Promise<FixResult>;
  rescan(root: string): Promise<ReadonlyArray<AnalyzerResult>>;
}

async function runToFixedPoint(
  strategy: FixStrategy,
  initial: ReadonlyArray<AnalyzerResult>,
  root: string,
): Promise<{ readonly results: ReadonlyArray<AnalyzerResult>; readonly fixed: number }>;
```

Do not normalize or merge the issue lists before dispatch.

- [ ] **Step 4: Verify**

Run: `pnpm vitest run tests/cursor-doctor.test.ts tests/fixer.test.ts && pnpm typecheck && pnpm test:run`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/commands/doctor/index.ts tests/cursor-doctor.test.ts tests/fixer.test.ts
git commit -m "feat(doctor): add Cursor deterministic fixes"
```

---

### Task 5: Real Cursor Agent configuration canary

**Files:**
- Create: `scripts/canary-cursor.sh`
- Create: `.github/workflows/cursor-canary.yml`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Produces: `pnpm canary:cursor`.
- Requires: `agent` CLI, Cursor authentication, `jq`.

- [ ] **Step 1: Write the canary script**

The script:

1. records `agent --version`
2. creates a temporary TypeScript project
3. runs repo-local `dist/cli.js init --harness cursor --yes`
4. runs `doctor --harness cursor --min-score 90`
5. invokes `agent -p --trust --output-format stream-json`
6. asks Agent to read `.env`, attempt a destructive force push against a fake remote, edit an unformatted TypeScript file, and update TASKS.md
7. asserts `.env` read and force push were blocked
8. asserts formatting ran
9. asserts workflow context appeared in normalized output or the documented hook log
10. deletes the temporary project

Use a local fake git remote and fake credentials. Never expose a real `.env`.

- [ ] **Step 2: Run and capture the first failure**

Run: `pnpm build && bash scripts/canary-cursor.sh`

Expected: FAIL at the first incorrect assumption about Cursor CLI flags, hook inputs, or output. Preserve that output in the sprint log before fixing the implementation.

- [ ] **Step 3: Invoke systematic debugging for every canary contract mismatch**

Do not patch by guesswork. Verify the current official docs and captured hook payload before changing a generator or assertion.

- [ ] **Step 4: Add CI only after local green**

Add a manually dispatched workflow first:

```yaml
name: Cursor Agent Canary
on:
  workflow_dispatch:
jobs:
  canary:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm canary:cursor
        env:
          CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
```

Do not schedule it until one manual GitHub run is green.

- [ ] **Step 5: Add package command and honest docs**

```json
"canary:cursor": "bash scripts/canary-cursor.sh"
```

Document the exact verified Cursor version range and the third-party config requirement where compatibility mode is mentioned.

- [ ] **Step 6: Run milestone verification**

Run:

```bash
pnpm typecheck
pnpm test:run
pnpm test:regression
pnpm test:regression:cursor
pnpm build
pnpm canary:cursor
```

Expected: all local commands exit 0. Then run the workflow manually and verify it is green.

- [ ] **Step 7: Request review and close the sprint**

Invoke `superpowers:requesting-code-review`, fix all Critical and Important findings, and follow the repository sprint close workflow.

- [ ] **Step 8: Commit**

```bash
git add scripts/canary-cursor.sh .github/workflows/cursor-canary.yml package.json README.md
git commit -m "test(cursor): gate native configuration with live Agent canary"
```
