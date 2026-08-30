# Cursor Milestone 1: Harness Foundation, Init, and Doctor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backward-compatible harness selection, native Cursor project scaffolding, and a read-only Cursor doctor that reports an independent score.

**Architecture:** Add a small discriminated harness registry around the existing Claude implementation instead of rewriting Claude analyzers. Cursor gets its own parser, generators, and analyzer pipeline while shared project detection, instruction content, TASKS.md, and BACKLOG.md remain common.

**Tech Stack:** TypeScript strict mode, Commander.js, Vitest, Node.js 22, JSON, Markdown/MDC.

**Spec:** `docs/superpowers/specs/2026-08-30-cursor-agent-support-design.md`

## Global Constraints

- Preserve all existing Claude command defaults and generated output.
- `init` defaults to `claude`; `doctor` defaults to `auto`.
- Cursor and Claude scores are never averaged.
- Never overwrite an existing unmarked user file.
- All new exported functions use named exports and immutable return values.
- Functions stay under 50 lines and files under 400 lines.
- Each task follows red-green-refactor TDD.
- No package version bump or release work in this milestone plan.

---

### Task 1: Harness identifiers, argument validation, and detection

**Files:**
- Create: `src/harness/types.ts`
- Create: `src/harness/registry.ts`
- Create: `tests/harness-registry.test.ts`

**Interfaces:**
- Produces: `HarnessId`, `HarnessSelection`, `parseHarnessSelection(value)`, `detectHarnesses(projectRoot)`, `resolveHarnesses(selection, detected)`.
- Consumes later: all four CLI commands.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectHarnesses,
  parseHarnessSelection,
  resolveHarnesses,
} from "../src/harness/registry.js";

describe("harness registry", () => {
  it.each(["auto", "claude", "cursor", "both"] as const)(
    "accepts %s",
    (value) => expect(parseHarnessSelection(value)).toBe(value),
  );

  it("rejects unknown harnesses with an actionable error", () => {
    expect(() => parseHarnessSelection("vscode")).toThrow(
      "Harness must be one of: auto, claude, cursor, both",
    );
  });

  it("detects Claude and Cursor independently", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-harness-"));
    await writeFile(join(root, "CLAUDE.md"), "# Claude");
    await mkdir(join(root, ".cursor", "rules"), { recursive: true });
    await writeFile(join(root, ".cursor", "rules", "core.mdc"), "---\nalwaysApply: true\n---\n");
    expect(await detectHarnesses(root)).toEqual(["claude", "cursor"]);
  });

  it("resolves auto to every detected harness", () => {
    expect(resolveHarnesses("auto", ["claude", "cursor"])).toEqual([
      "claude",
      "cursor",
    ]);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/harness-registry.test.ts`

Expected: FAIL because `src/harness/registry.ts` does not exist.

- [ ] **Step 3: Implement the types and pure selection logic**

```typescript
// src/harness/types.ts
export type HarnessId = "claude" | "cursor";
export type HarnessSelection = HarnessId | "auto" | "both";

export interface HarnessProfile<TConfig> {
  readonly id: HarnessId;
  readonly displayName: string;
  detect(projectRoot: string): Promise<boolean>;
  parse(projectRoot: string): Promise<TConfig>;
}
```

```typescript
// src/harness/registry.ts
import { access } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessId, HarnessSelection } from "./types.js";

const VALID = new Set<HarnessSelection>(["auto", "claude", "cursor", "both"]);

export function parseHarnessSelection(value: string): HarnessSelection {
  if (VALID.has(value as HarnessSelection)) return value as HarnessSelection;
  throw new Error("Harness must be one of: auto, claude, cursor, both");
}

export async function detectHarnesses(root: string): Promise<ReadonlyArray<HarnessId>> {
  const [claude, cursor] = await Promise.all([
    exists(join(root, "CLAUDE.md"), join(root, ".claude", "settings.json")),
    exists(join(root, "AGENTS.md"), join(root, ".cursor")),
  ]);
  return [
    ...(claude ? ["claude" as const] : []),
    ...(cursor ? ["cursor" as const] : []),
  ];
}

export function resolveHarnesses(
  selection: HarnessSelection,
  detected: ReadonlyArray<HarnessId>,
): ReadonlyArray<HarnessId> {
  if (selection === "both") return ["claude", "cursor"];
  if (selection === "auto") return [...detected];
  return [selection];
}

async function exists(...paths: ReadonlyArray<string>): Promise<boolean> {
  const checks = await Promise.all(paths.map((path) => access(path).then(() => true).catch(() => false)));
  return checks.some(Boolean);
}
```

- [ ] **Step 4: Run focused and full verification**

Run: `pnpm vitest run tests/harness-registry.test.ts && pnpm typecheck && pnpm test:run`

Expected: focused tests pass, typecheck exits 0, existing suite remains green.

- [ ] **Step 5: Commit**

```bash
git add src/harness/types.ts src/harness/registry.ts tests/harness-registry.test.ts
git commit -m "refactor: introduce coding-agent harness registry"
```

---

### Task 2: Claude profile as the regression-preserving adapter

**Files:**
- Create: `src/harness/claude/profile.ts`
- Create: `tests/claude-harness-profile.test.ts`

**Interfaces:**
- Consumes: `HarnessProfile<TConfig>` and existing `parseClaudeConfig()`.
- Produces: `claudeHarnessProfile: HarnessProfile<ClaudeConfig>`.

- [ ] **Step 1: Write a failing delegation test**

```typescript
import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { claudeHarnessProfile } from "../src/harness/claude/profile.js";

describe("claude harness profile", () => {
  it("detects and parses the existing Claude surface without translation", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-claude-profile-"));
    await writeFile(join(root, "CLAUDE.md"), "# Demo\n- Run tests");
    expect(await claudeHarnessProfile.detect(root)).toBe(true);
    const config = await claudeHarnessProfile.parse(root);
    expect(config.claudeMdContent).toContain("Run tests");
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/claude-harness-profile.test.ts`

Expected: FAIL because the profile does not exist.

- [ ] **Step 3: Implement the thin profile**

```typescript
import { access } from "node:fs/promises";
import { join } from "node:path";
import { parseClaudeConfig } from "../../lib/parser.js";
import type { ClaudeConfig } from "../../types/index.js";
import type { HarnessProfile } from "../types.js";

export const claudeHarnessProfile: HarnessProfile<ClaudeConfig> = {
  id: "claude",
  displayName: "Claude Code",
  async detect(root) {
    return access(join(root, "CLAUDE.md")).then(() => true).catch(() => false);
  },
  parse: parseClaudeConfig,
};
```

- [ ] **Step 4: Verify**

Run: `pnpm vitest run tests/claude-harness-profile.test.ts tests/parser.test.ts && pnpm typecheck`

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/harness/claude/profile.ts tests/claude-harness-profile.test.ts
git commit -m "refactor: wrap Claude config in harness profile"
```

---

### Task 3: Cursor configuration parser

**Files:**
- Create: `src/harness/cursor/types.ts`
- Create: `src/harness/cursor/parser.ts`
- Create: `src/harness/cursor/profile.ts`
- Create: `tests/cursor-parser.test.ts`

**Interfaces:**
- Produces: `CursorConfig`, `parseCursorConfig(root)`, `cursorHarnessProfile`.
- Normalizes native Cursor hooks into existing `HookConfig` records where fields overlap.

- [ ] **Step 1: Write failing parser tests**

```typescript
import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCursorConfig } from "../src/harness/cursor/parser.js";

describe("parseCursorConfig", () => {
  it("reads instructions, rules, skills, agents, hooks, MCP, and ignore policy", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-parser-"));
    await mkdir(join(root, ".cursor", "rules"), { recursive: true });
    await mkdir(join(root, ".cursor", "skills", "demo"), { recursive: true });
    await mkdir(join(root, ".cursor", "agents"), { recursive: true });
    await writeFile(join(root, "AGENTS.md"), "# Demo\n- Run tests");
    await writeFile(join(root, ".cursor", "rules", "core.mdc"), "---\nalwaysApply: true\n---\n# Core");
    await writeFile(join(root, ".cursor", "skills", "demo", "SKILL.md"), "---\nname: demo\ndescription: Demo\n---\n");
    await writeFile(join(root, ".cursor", "agents", "reviewer.md"), "---\nname: reviewer\ndescription: Review\n---\n");
    await writeFile(join(root, ".cursor", "hooks.json"), JSON.stringify({
      version: 1,
      hooks: { beforeShellExecution: [{ command: ".cursor/hooks/guard.sh", failClosed: true }] },
    }));
    await writeFile(join(root, ".cursor", "mcp.json"), JSON.stringify({
      mcpServers: { memory: { command: "npx", args: ["claude-launchpad", "memory", "serve"] } },
    }));
    await writeFile(join(root, ".cursorignore"), ".env\n");

    const config = await parseCursorConfig(root);
    expect(config.instructionsContent).toContain("Run tests");
    expect(config.rules).toHaveLength(1);
    expect(config.skills).toHaveLength(1);
    expect(config.agents).toHaveLength(1);
    expect(config.hooks[0]).toMatchObject({
      event: "beforeShellExecution",
      command: ".cursor/hooks/guard.sh",
      failClosed: true,
    });
    expect(config.mcpServers[0]?.name).toBe("memory");
    expect(config.ignoreContent).toContain(".env");
  });

  it("returns null or empty collections for a partial project", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-partial-"));
    expect(await parseCursorConfig(root)).toMatchObject({
      instructionsContent: null,
      hooks: [],
      rules: [],
      skills: [],
      agents: [],
      mcpServers: [],
      parseErrors: [],
    });
  });

  it("records malformed JSON instead of treating it as absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "lp-cursor-invalid-"));
    await mkdir(join(root, ".cursor"), { recursive: true });
    await writeFile(join(root, ".cursor", "hooks.json"), "{ invalid");
    const config = await parseCursorConfig(root);
    expect(config.parseErrors).toEqual([{
      path: ".cursor/hooks.json",
      message: "Invalid JSON",
    }]);
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/cursor-parser.test.ts`

Expected: FAIL because the parser does not exist.

- [ ] **Step 3: Define Cursor-specific types**

```typescript
import type { HookConfig, McpServerConfig } from "../../types/index.js";

export interface CursorHookConfig extends HookConfig {
  readonly failClosed?: boolean;
}

export interface CursorParseError {
  readonly path: string;
  readonly message: string;
}

export interface CursorConfig {
  readonly instructionsPath: string | null;
  readonly instructionsContent: string | null;
  readonly instructionCount: number;
  readonly hooksPath: string | null;
  readonly hooks: ReadonlyArray<CursorHookConfig>;
  readonly rules: ReadonlyArray<string>;
  readonly skills: ReadonlyArray<string>;
  readonly agents: ReadonlyArray<string>;
  readonly mcpServers: ReadonlyArray<McpServerConfig>;
  readonly ignorePath: string | null;
  readonly ignoreContent: string | null;
  readonly sandbox: Record<string, unknown> | null;
  readonly parseErrors: ReadonlyArray<CursorParseError>;
}
```

- [ ] **Step 4: Implement focused readers in `parser.ts`**

Implement named helpers:

```typescript
export async function parseCursorConfig(root: string): Promise<CursorConfig>;
async function readCursorHooks(root: string): Promise<ReadonlyArray<CursorHookConfig>>;
async function readCursorMcp(root: string): Promise<ReadonlyArray<McpServerConfig>>;
async function readMarkdownTree(path: string): Promise<ReadonlyArray<string>>;
async function readJsonObject(path: string): Promise<Record<string, unknown> | null>;
```

Rules:

- read `AGENTS.md`
- read `.cursor/hooks.json`
- recursively list `.cursor/rules/*.{mdc,md,markdown}`
- recursively list `.cursor/skills/**/SKILL.md`
- list `.cursor/agents/*.{mdc,md,markdown}`
- read `.cursor/mcp.json`
- read `.cursorignore`
- read `.cursor/sandbox.json`
- record invalid JSON in `parseErrors` with a project-relative path and avoid throwing

- [ ] **Step 5: Add the Cursor profile and verify**

```typescript
import type { HarnessProfile } from "../types.js";
import { parseCursorConfig } from "./parser.js";
import type { CursorConfig } from "./types.js";

export const cursorHarnessProfile: HarnessProfile<CursorConfig> = {
  id: "cursor",
  displayName: "Cursor Agent",
  async detect(root) {
    const config = await parseCursorConfig(root);
    return config.instructionsContent !== null || config.hooksPath !== null || config.rules.length > 0;
  },
  parse: parseCursorConfig,
};
```

Run: `pnpm vitest run tests/cursor-parser.test.ts && pnpm typecheck`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/harness/cursor tests/cursor-parser.test.ts
git commit -m "feat(cursor): parse native project configuration"
```

---

### Task 4: Shared instruction model and Cursor generators

**Files:**
- Create: `src/commands/init/generators/agent-instructions.ts`
- Create: `src/harness/cursor/generators.ts`
- Create: `tests/fixtures/detected-project.ts`
- Create: `tests/cursor-generators.test.ts`
- Modify: `src/commands/init/generators/claude-md.ts`

**Interfaces:**
- Produces: `buildAgentInstructions(options, detected, features)`, `generateAgentsMd()`, `generateCursorRule()`, `generateCursorHooks()`, `generateCursorIgnore()`, `generateCursorReviewer()`, `generateCursorEnhanceSkill()`.
- Preserves: `generateClaudeMd()` output through snapshot/equality regression tests.

- [ ] **Step 1: Freeze existing Claude output in a regression test**

Create `tests/agent-instructions.test.ts`. Add a test that calls `generateClaudeMd()` with a fixed `DetectedProject` fixture and stores the exact current output in an inline snapshot.

Run: `pnpm vitest run tests/agent-instructions.test.ts -u`

Expected: PASS before refactoring.

- [ ] **Step 2: Write failing Cursor generator tests**

```typescript
// tests/fixtures/detected-project.ts
export const fixedDetectedProject: DetectedProject = {
  name: "demo",
  language: "TypeScript",
  framework: "Next.js",
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

it("renders Cursor rules with valid MDC frontmatter", () => {
  const content = generateCursorRule({
    description: "Workflow rules",
    globs: "{BACKLOG.md,TASKS.md}",
    alwaysApply: false,
    body: "# Workflow\n- Keep one source of truth",
    marker: "lp-cursor-workflow-version: 1",
  });
  expect(content).toContain("description: Workflow rules");
  expect(content).toContain("globs: {BACKLOG.md,TASKS.md}");
  expect(content).toContain("alwaysApply: false");
  expect(content).toContain("<!-- lp-cursor-workflow-version: 1 -->");
});

it("renders native fail-closed security hooks", () => {
  const hooks = generateCursorHooks(fixedDetectedProject);
  expect(hooks.version).toBe(1);
  expect(hooks.hooks.beforeShellExecution?.[0]?.failClosed).toBe(true);
  expect(hooks.hooks.beforeReadFile?.[0]?.failClosed).toBe(true);
});
```

- [ ] **Step 3: Run and verify RED**

Run: `pnpm vitest run tests/cursor-generators.test.ts`

Expected: FAIL because the Cursor generators do not exist.

- [ ] **Step 4: Extract shared content without changing Claude output**

Move semantic section construction from `claude-md.ts` into:

```typescript
export interface AgentInstructionDocument {
  readonly title: string;
  readonly sections: ReadonlyArray<{
    readonly heading: string;
    readonly lines: ReadonlyArray<string>;
  }>;
}

export function buildAgentInstructions(
  options: InitOptions,
  detected: DetectedProject,
  features: { readonly superpowers: boolean },
): AgentInstructionDocument;
```

Keep `generateClaudeMd()` as a renderer over the document and verify its frozen output is unchanged.

- [ ] **Step 5: Implement Cursor renderers**

Cursor hooks must use:

- `beforeReadFile` for `.env` reads
- `beforeShellExecution` for destructive shell commands
- `afterFileEdit` for formatting and workflow checks
- `afterShellExecution` for sprint-open checks
- `sessionStart` for TASKS.md injection
- `failClosed: true` on security hooks
- script paths under `.cursor/hooks/`

Generate `AGENTS.md` from `AgentInstructionDocument`. Generate rules from the existing workflow, hooks, verification, and convention bodies with Cursor frontmatter.

- [ ] **Step 6: Verify**

Run: `pnpm vitest run tests/cursor-generators.test.ts tests/agent-instructions.test.ts tests/settings-generator.test.ts && pnpm typecheck`

Expected: Cursor tests pass and Claude output remains byte-for-byte stable.

- [ ] **Step 7: Commit**

```bash
git add src/commands/init/generators src/harness/cursor/generators.ts tests
git commit -m "feat(cursor): render native instructions rules and hooks"
```

---

### Task 5: Cursor scaffold and CLI init selection

**Files:**
- Create: `src/harness/cursor/scaffold.ts`
- Create: `tests/cursor-init.test.ts`
- Modify: `src/commands/init/index.ts`
- Modify: `src/cli.ts`

**Interfaces:**
- Produces: `scaffoldCursor(root, options, detected): Promise<ScaffoldResult>`.
- Consumes: harness parser and generators from Tasks 3 and 4.

- [ ] **Step 1: Write a failing end-to-end scaffold test**

```typescript
import { fixedDetectedProject } from "./fixtures/detected-project.js";

it("creates the complete Cursor surface without Claude files", async () => {
  const root = await mkdtemp(join(tmpdir(), "lp-cursor-init-"));
  await scaffoldCursor(
    root,
    { name: "demo", description: "" },
    fixedDetectedProject,
  );
  const expected = [
    "AGENTS.md",
    "TASKS.md",
    "BACKLOG.md",
    ".cursor/hooks.json",
    ".cursorignore",
    ".cursor/rules/conventions.mdc",
    ".cursor/rules/workflow.mdc",
    ".cursor/rules/hooks.mdc",
    ".cursor/rules/verification.mdc",
    ".cursor/agents/code-reviewer.md",
    ".cursor/skills/lp-enhance/SKILL.md",
  ];
  await Promise.all(expected.map((path) => access(join(root, path))));
  expect(await fileExists(join(root, "CLAUDE.md"))).toBe(false);
});
```

Also add tests for:

- `--harness both` creates both surfaces and shared TASKS/BACKLOG once
- existing unmarked Cursor files are preserved
- second init is idempotent
- omitted `--harness` retains current Claude output

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/cursor-init.test.ts`

Expected: FAIL because `--harness` is unknown.

- [ ] **Step 3: Implement `scaffoldCursor()`**

Return an immutable result:

```typescript
export interface ScaffoldResult {
  readonly created: ReadonlyArray<string>;
  readonly preserved: ReadonlyArray<string>;
}
```

Use atomic file writes where existing helpers support them. Create `.cursor/hooks/` scripts from shared script bodies and make them executable.

- [ ] **Step 4: Add and validate `--harness`**

Add:

```typescript
.option(
  "--harness <harness>",
  "Target harness: claude, cursor, or both",
  "claude",
)
```

Parse through `parseHarnessSelection()`. Reject `auto` for init because an unconfigured project has nothing reliable to detect.

Update `src/cli.ts` default routing to use `detectHarnesses(process.cwd())`: route to doctor when either harness is found and retain setup guidance only when none is found. Make root, init, and doctor descriptions say "coding agent configuration" or name both supported harnesses rather than claiming Claude-only scope. Change `--force` help from "Overwrite existing CLAUDE.md" to "Overwrite existing generated instruction file"; behavior remains limited by the selected harness.

- [ ] **Step 5: Verify**

Run: `pnpm vitest run tests/cursor-init.test.ts tests/settings-generator.test.ts tests/agent-reviewer.test.ts && pnpm typecheck`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts src/commands/init/index.ts src/harness/cursor/scaffold.ts tests/cursor-init.test.ts
git commit -m "feat(init): scaffold Cursor Agent projects"
```

---

### Task 6: Read-only Cursor doctor

**Files:**
- Create: `src/harness/cursor/doctor.ts`
- Create: `src/harness/cursor/analyzers/instructions.ts`
- Create: `src/harness/cursor/analyzers/hooks.ts`
- Create: `src/harness/cursor/analyzers/rules.ts`
- Create: `src/harness/cursor/analyzers/security.ts`
- Create: `src/harness/cursor/analyzers/mcp.ts`
- Create: `tests/cursor-doctor.test.ts`
- Create: `tests/doctor-watcher.test.ts`
- Modify: `src/commands/doctor/index.ts`
- Modify: `src/commands/doctor/watcher.ts`
- Modify: `src/lib/output.ts`

**Interfaces:**
- Produces: `runCursorAnalyzers(config, root): Promise<ReadonlyArray<AnalyzerResult>>`.
- Reuses: `countInstructions()`, quality intent logic, workflow analyzer, MCP transport validation.

- [ ] **Step 1: Write failing behavior tests**

Cover these exact findings:

```typescript
function findIssue(
  results: ReadonlyArray<AnalyzerResult>,
  analyzer: string,
  message: string,
): DiagnosticIssue | undefined {
  return results
    .flatMap((result) => result.issues)
    .find((issue) => issue.analyzer === analyzer && issue.message.includes(message));
}

expect(findIssue(result, "Instructions", "No AGENTS.md")?.severity).toBe("high");
expect(findIssue(result, "Hooks", "security hook is not fail-closed")?.severity).toBe("high");
expect(findIssue(result, "Rules", "No .cursor/rules/verification.mdc")?.severity).toBe("medium");
expect(findIssue(result, "Security", ".env is missing from .cursorignore")?.severity).toBe("medium");
expect(findIssue(result, "MCP", "stdio transport but has no command")?.severity).toBe("high");
expect(result.flatMap((entry) => entry.issues).some((issue) => issue.message.includes("Claude"))).toBe(false);
```

Add a complete fixture generated by `scaffoldCursor()` that scores 100 with no actionable issues. If the honest baseline cannot reach 100, encode and explain the actual expected score instead of weakening checks.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm vitest run tests/cursor-doctor.test.ts`

Expected: FAIL because the Cursor doctor does not exist.

- [ ] **Step 3: Implement focused analyzers**

Cursor checks include:

- `AGENTS.md` instruction budget and required intents
- rules frontmatter validity and version markers
- hook schema version, event names, command paths, executable scripts, helper dependencies
- `failClosed: true` for `.env` and destructive-shell guards
- `.cursorignore` defense in depth
- sandbox validity without requiring a sandbox file
- MCP command/URL validity
- local versus cloud hook support warnings
- skill and agent frontmatter required fields
- malformed JSON from `CursorConfig.parseErrors`

Do not check Claude permission keys, `allowedMcpServers`, or `autoMemoryEnabled`.

- [ ] **Step 4: Dispatch doctor by harness**

`doctor --harness auto` resolves detected harnesses. For both, render two titled reports and emit:

```json
{
  "harnesses": {
    "claude": { "overallScore": 100, "analyzers": [] },
    "cursor": { "overallScore": 92, "analyzers": [] }
  },
  "timestamp": "..."
}
```

Keep the existing single-Claude JSON shape when only Claude is selected to avoid breaking consumers in this milestone.

- [ ] **Step 5: Verify no fixer runs for Cursor**

Add a test that `doctor --harness cursor --fix` exits non-zero with:

```text
Cursor --fix is not available yet. Run doctor without --fix for diagnostics.
```

This prevents accidental dispatch into the Claude FIX_TABLE.

- [ ] **Step 6: Make watch mode harness-aware**

Remove analyzer imports and `runAndDisplay()` from `watcher.ts`. Accept the selected harnesses and a scan callback:

```typescript
export async function watchConfig(
  projectRoot: string,
  harnesses: ReadonlyArray<HarnessId>,
  scanAndRender: () => Promise<void>,
): Promise<never>;

export async function getConfigSnapshot(
  projectRoot: string,
  harnesses: ReadonlyArray<HarnessId>,
): Promise<string>;
```

`getConfigSnapshot()` includes:

- Claude: `CLAUDE.md`, `.claudeignore`, `.claude/**`
- Cursor: `AGENTS.md`, `.cursorignore`, `.cursor/**`

Add tests that editing one file in each selected surface changes the snapshot and that Cursor-only selection ignores `.claude/**`. `createDoctorCommand()` resolves harnesses before entering watch mode and passes the same scan path used by one-shot doctor, preventing analyzer drift.

- [ ] **Step 7: Run full verification**

Run: `pnpm vitest run tests/cursor-doctor.test.ts tests/doctor-watcher.test.ts tests/parser.test.ts tests/fixer.test.ts && pnpm typecheck && pnpm test:run`

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/harness/cursor src/commands/doctor/index.ts src/commands/doctor/watcher.ts src/lib/output.ts tests/cursor-doctor.test.ts tests/doctor-watcher.test.ts
git commit -m "feat(doctor): diagnose Cursor Agent configuration"
```

---

### Task 7: Cursor regression fixture and milestone verification

**Files:**
- Create: `tests/regression/cursor-doctor-regression.sh`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/content/docs/index.mdx`
- Modify: `docs/content/docs/init.mdx`
- Modify: `docs/content/docs/doctor.mdx`

**Interfaces:**
- Produces: `pnpm test:regression:cursor`.

- [ ] **Step 1: Write the regression script before adding the package command**

The script must build once, use `node "$REPO_ROOT/dist/cli.js"` explicitly, and verify:

1. empty project diagnosis
2. `init --harness cursor --yes`
3. generated file set
4. doctor human output
5. doctor JSON output
6. score threshold behavior
7. idempotent second init
8. no Claude files in cursor-only mode
9. separate reports in both mode
10. malformed hooks.json fails safely without clobbering

- [ ] **Step 2: Run and verify RED**

Run: `bash tests/regression/cursor-doctor-regression.sh`

Expected: FAIL until the package script and any uncovered wiring defects are fixed.

- [ ] **Step 3: Add the package script**

```json
"test:regression:cursor": "pnpm build && bash tests/regression/cursor-doctor-regression.sh"
```

Keep existing `test:regression` unchanged.

- [ ] **Step 4: Update docs with exact scope**

State:

- Cursor Agent local configuration is supported
- Cursor doctor is read-only in Milestone 1
- eval and memory remain Claude-only until later milestones
- Cursor Cloud memory is not supported

- [ ] **Step 5: Run milestone verification**

Run:

```bash
pnpm typecheck
pnpm test:run
pnpm test:regression
pnpm test:regression:cursor
pnpm build
```

Expected: all commands exit 0. Record exact test counts in the sprint closeout rather than predicting them in this plan.

- [ ] **Step 6: Request code review and close the sprint**

Invoke `superpowers:requesting-code-review` with the sprint base and head SHAs. Fix all Critical and Important findings. Then follow the repository sprint close workflow.

- [ ] **Step 7: Commit**

```bash
git add package.json README.md docs tests/regression/cursor-doctor-regression.sh
git commit -m "docs: document Cursor foundation support and regression gate"
```
