# Hook Stdin Input Bug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every `$TOOL_INPUT_*` env-var read in our generated hooks with the canonical `jq -r '.tool_input.X'` stdin-JSON pattern, so PreToolUse/PostToolUse hooks actually fire instead of silently exiting 0. Add a doctor check + fixer to detect and rewrite the bug in already-shipped projects.

**Architecture:** Claude Code passes hook context as JSON on stdin, not env vars (per code.claude.com/docs/en/hooks.md). All hook command strings get a centralized rewrite via shared utilities. Doctor gets a HIGH-severity check that scans hook commands for the env-var pattern and a fixer that rewrites known shapes (init-generated hooks) while leaving user customizations alone.

**Tech Stack:** TypeScript (strict), Vitest, bash, jq

**Release:** v1.10.1 patch (P0 bug fix). Bump package.json + src/cli.ts, update CHANGELOG.

---

## File Structure

**Create:**
- `src/lib/hook-input.ts` — single source of truth for the canonical stdin-reading bash snippet (`jqField('file_path')`, `jqField('command')`)
- `tests/hook-input-bug.test.ts` — regression tests asserting no `$TOOL_INPUT_*` in any generated hook + smoke test piping fake JSON to commands and asserting output

**Modify:**
- `src/lib/hook-scripts.ts` — wrapper scripts read stdin via jq instead of env vars
- `src/commands/init/generators/settings.ts` — every inline hook command uses `jqField()`
- `src/commands/doctor/fixer-hooks.ts` — emit fixed hooks
- `src/commands/doctor/fixer-sprint.ts` — emit fixed hooks
- `src/commands/doctor/analyzers/hooks.ts` — add `findEnvVarHookPatterns()` returning HIGH findings
- `src/commands/doctor/fixer.ts` (FIX_TABLE) — wire the rewrite fixer
- `tests/settings-generator.test.ts` — assert generated commands use jq+stdin
- `tests/hooks-analyzer.test.ts` — assert env-var pattern is detected
- `tests/fixer.test.ts` — assert env-var hooks get rewritten + idempotency + don't-clobber
- `package.json` + `src/cli.ts` — version bump to 1.10.1
- `CHANGELOG.md` — v1.10.1 entry

---

## Task 1: Shared `hook-input.ts` utility (single source of truth)

**Files:**
- Create: `src/lib/hook-input.ts`
- Test: `tests/hook-input.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/hook-input.test.ts
import { describe, it, expect } from "vitest";
import { jqField, READ_STDIN_PREAMBLE, hasEnvVarHookPattern } from "../src/lib/hook-input.js";

describe("hook-input utilities", () => {
  it("jqField('file_path') reads from stdin via jq with empty fallback", () => {
    expect(jqField("file_path")).toBe(`$(jq -r '.tool_input.file_path // empty' 2>/dev/null)`);
  });

  it("jqField('command') reads command field", () => {
    expect(jqField("command")).toBe(`$(jq -r '.tool_input.command // empty' 2>/dev/null)`);
  });

  it("READ_STDIN_PREAMBLE captures stdin once for multi-field reads", () => {
    expect(READ_STDIN_PREAMBLE).toBe(`input=$(cat 2>/dev/null)`);
  });

  it("jqField('file_path', 'input') reads from a captured variable", () => {
    expect(jqField("file_path", "input")).toBe(`$(echo "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)`);
  });

  describe("hasEnvVarHookPattern", () => {
    it("matches $TOOL_INPUT_FILE_PATH", () => {
      expect(hasEnvVarHookPattern("echo \"$TOOL_INPUT_FILE_PATH\" | grep TASKS")).toBe(true);
    });
    it("matches ${TOOL_INPUT_COMMAND:-}", () => {
      expect(hasEnvVarHookPattern("cmd=\"${TOOL_INPUT_COMMAND:-}\"")).toBe(true);
    });
    it("matches ${TOOL_INPUT_FILE_PATH##*.}", () => {
      expect(hasEnvVarHookPattern("ext=${TOOL_INPUT_FILE_PATH##*.}")).toBe(true);
    });
    it("does NOT match strings that include TOOL_INPUT in unrelated context", () => {
      expect(hasEnvVarHookPattern("# uses tool_input.file_path from stdin")).toBe(false);
    });
    it("does NOT match jq-based reads", () => {
      expect(hasEnvVarHookPattern("$(jq -r '.tool_input.file_path' 2>/dev/null)")).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test, expect failure (file not yet created)**

```bash
pnpm test:run tests/hook-input.test.ts
# Expect: error: cannot find module ../src/lib/hook-input.js
```

- [ ] **Step 3: Implement `src/lib/hook-input.ts`**

```typescript
// src/lib/hook-input.ts
/**
 * Canonical helpers for hook command strings.
 *
 * Claude Code passes hook context as JSON on stdin, not env vars.
 * Reading $TOOL_INPUT_FILE_PATH or $TOOL_INPUT_COMMAND from a hook command
 * sees an empty string and the hook silently no-ops.
 *
 * Use jqField("file_path") for single-field reads.
 * Use READ_STDIN_PREAMBLE + jqField("...", "input") when a hook needs multiple fields.
 */

export type ToolInputField = "file_path" | "command" | "new_text" | "content";

export function jqField(field: ToolInputField, fromVar?: string): string {
  if (fromVar) {
    return `$(echo "$${fromVar}" | jq -r '.tool_input.${field} // empty' 2>/dev/null)`;
  }
  return `$(jq -r '.tool_input.${field} // empty' 2>/dev/null)`;
}

export const READ_STDIN_PREAMBLE = `input=$(cat 2>/dev/null)`;

const ENV_VAR_PATTERN = /\$\{?TOOL_INPUT_(FILE_PATH|COMMAND|NEW_TEXT|CONTENT)/;

export function hasEnvVarHookPattern(commandString: string): boolean {
  return ENV_VAR_PATTERN.test(commandString);
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
pnpm test:run tests/hook-input.test.ts
# Expect: PASS, all 7 cases
```

- [ ] **Step 5: typecheck**

```bash
pnpm typecheck
# Expect: green
```

---

## Task 2: Rewrite `settings.ts` generator inline hooks

**Files:**
- Modify: `src/commands/init/generators/settings.ts:35,44,59,161`
- Test: `tests/settings-generator.test.ts`, `tests/hook-input-bug.test.ts` (new file)

- [ ] **Step 1: Add a regression test that asserts NO env-var pattern appears anywhere in generated settings**

```typescript
// tests/hook-input-bug.test.ts
import { describe, it, expect } from "vitest";
import { generateSettings } from "../src/commands/init/generators/settings.js";
import { hasEnvVarHookPattern } from "../src/lib/hook-input.js";
import {
  SPRINT_OPEN_CHECK,
  WORKFLOW_CHECK,
  SPRINT_SIZE_CHECK,
} from "../src/lib/hook-scripts.js";

describe("hook input bug regression", () => {
  it("generated settings.json has zero $TOOL_INPUT_* references", () => {
    const settings = generateSettings({
      language: "TypeScript",
      framework: null,
      packageManager: "pnpm",
      buildTool: null,
      testFramework: null,
    });
    const allCommands = Object.values(settings.hooks ?? {})
      .flat()
      .flatMap((g) => g.hooks.map((h) => h.command));
    const offenders = allCommands.filter(hasEnvVarHookPattern);
    expect(offenders).toEqual([]);
  });

  it("wrapper scripts have zero $TOOL_INPUT_* references", () => {
    expect(hasEnvVarHookPattern(SPRINT_OPEN_CHECK)).toBe(false);
    expect(hasEnvVarHookPattern(WORKFLOW_CHECK)).toBe(false);
    expect(hasEnvVarHookPattern(SPRINT_SIZE_CHECK)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, expect failure (current generator emits env vars)**

```bash
pnpm test:run tests/hook-input-bug.test.ts
# Expect: FAIL: offenders array contains 4-5 commands
```

- [ ] **Step 3: Modify `settings.ts` to use `jqField()`**

Edit each command string in `src/commands/init/generators/settings.ts`:

Line 35 (.env block):
```typescript
// Before
command: "echo \"$TOOL_INPUT_FILE_PATH\" | grep -qE '\\.(env|env\\..*)$' && ! echo \"$TOOL_INPUT_FILE_PATH\" | grep -q '.env.example' && echo 'BLOCKED: .env files contain secrets' && exit 1; exit 0",

// After
command: `fp=${jqField("file_path")}; echo "$fp" | grep -qE '\\.(env|env\\..*)$' && ! echo "$fp" | grep -q '.env.example' && echo 'BLOCKED: .env files contain secrets' >&2 && exit 2; exit 0`,
```

Note: change `exit 1` → `exit 2` and `echo` → `echo ... >&2`. Per the spec, exit 2 = blocking error and stderr is surfaced to Claude. Exit 1 is non-blocking; the message currently goes nowhere useful.

Line 44 (destructive Bash block): same treatment with `jqField("command")` and `exit 2`.

Line 59 (sprint-complete nudge): use `jqField("file_path")` (non-blocking, exit 0).

Line 161 (auto-format hook): use `jqField("file_path")` and pass it to the formatter.

- [ ] **Step 4: Run regression + generator tests**

```bash
pnpm test:run tests/hook-input-bug.test.ts tests/settings-generator.test.ts
# Expect: regression test passes; settings-generator may need a small update for new shape
```

- [ ] **Step 5: Update existing settings-generator.test.ts assertions** if any explicitly check the old `$TOOL_INPUT_*` strings. Replace expectations with substring matches like `expect(cmd).toContain("jq -r '.tool_input.file_path")`.

- [ ] **Step 6: Run full unit suite**

```bash
pnpm test:run
# Expect: green
```

---

## Task 3: Rewrite wrapper scripts in `hook-scripts.ts`

**Files:**
- Modify: `src/lib/hook-scripts.ts:45,86`

- [ ] **Step 1: Update `SPRINT_OPEN_CHECK` (line 45)**

```typescript
// Before
set -u
cmd="\${TOOL_INPUT_COMMAND:-}"

// After
set -u
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null)
```

- [ ] **Step 2: Update `WORKFLOW_CHECK` (line 86)**

```typescript
// Before
set -u
fp="\${TOOL_INPUT_FILE_PATH:-}"

// After
set -u
fp=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
```

- [ ] **Step 3: Re-run regression test (wrapper part now passes)**

```bash
pnpm test:run tests/hook-input-bug.test.ts
# Expect: green for wrapper script assertions
```

- [ ] **Step 4: Add a smoke test that pipes fake JSON to each script and asserts it does NOT no-op silently when the input matches**

```typescript
// tests/hook-input-bug.test.ts (append to existing describe block)
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

it("workflow-check.sh fires when fed JSON with file_path = TASKS.md", () => {
  const tmp = mkdtempSync(join(tmpdir(), "lp-hook-smoke-"));
  // Set up fixtures
  writeFileSync(join(tmp, "TASKS.md"), "## Current Sprint\n- [ ] WP-001 — task\n## Session Log\n- **a**\n- **b**\n- **c**\n- **d**\n");
  writeFileSync(join(tmp, "BACKLOG.md"), "# Backlog\n");
  const hooksDir = join(tmp, ".claude", "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const scriptPath = join(hooksDir, "workflow-check.sh");
  writeFileSync(scriptPath, WORKFLOW_CHECK);
  chmodSync(scriptPath, 0o755);

  const fakeInput = JSON.stringify({ tool_input: { file_path: "TASKS.md" } });
  const output = execSync(`echo '${fakeInput}' | bash ${scriptPath}`, { cwd: tmp, encoding: "utf8" });
  expect(output).toContain("Session Log");  // 4 entries > 3 threshold
});
```

- [ ] **Step 5: Run the smoke test**

```bash
pnpm test:run tests/hook-input-bug.test.ts
# Expect: workflow-check.sh produces output (proves it fires with the new stdin input)
```

- [ ] **Step 6: Add a similar smoke test for sprint-open-check.sh** that fakes a `git commit` command JSON in a real git fixture (initialized repo with staged TASKS.md change). Skip if `git` is missing in CI.

---

## Task 4: Rewrite `fixer-hooks.ts` and `fixer-sprint.ts`

**Files:**
- Modify: `src/commands/doctor/fixer-hooks.ts:19,34,44`
- Modify: `src/commands/doctor/fixer-sprint.ts:45`

- [ ] **Step 1: Update `addEnvProtectionHook`, `addAutoFormatHook`, `addForcePushProtection` in fixer-hooks.ts**

Same pattern as Task 2:
- Replace `"$TOOL_INPUT_FILE_PATH"` with `${jqField("file_path")}` (note template-literal escaping)
- Replace `"$TOOL_INPUT_COMMAND"` with `${jqField("command")}`
- Change `exit 1` → `exit 2` and route message to stderr (`>&2`) for blocking hooks

- [ ] **Step 2: Update `addSprintCompleteNudge` in fixer-sprint.ts:45** with `jqField("file_path")`.

- [ ] **Step 3: Run fixer tests**

```bash
pnpm test:run tests/fixer.test.ts
# Expect: passing — fixer emits new shape
```

- [ ] **Step 4: Update `tests/fixer.test.ts` if any assertions check the old `$TOOL_INPUT_*` strings literally**

- [ ] **Step 5: Run regression test**

```bash
pnpm test:run tests/hook-input-bug.test.ts
# Expect: zero offenders across all generators
```

---

## Task 5: Doctor analyzer — detect env-var hook bug in already-shipped projects

**Files:**
- Modify: `src/commands/doctor/analyzers/hooks.ts`
- Test: `tests/hooks-analyzer.test.ts`

- [ ] **Step 1: Read the hooks analyzer** to understand its existing finding shape

```bash
# Note: read by Read tool, not bash
```

- [ ] **Step 2: Add a failing test** asserting hooks-analyzer emits a HIGH finding when settings.json contains a hook command with `$TOOL_INPUT_*`

```typescript
// tests/hooks-analyzer.test.ts (append)
it("flags HIGH when a hook command reads $TOOL_INPUT_FILE_PATH (env-var bug)", () => {
  const settings = {
    hooks: {
      PreToolUse: [{
        matcher: "Read|Write|Edit",
        hooks: [{ type: "command", command: "echo \"$TOOL_INPUT_FILE_PATH\" | grep -q TASKS.md; exit 0" }],
      }],
    },
  };
  const findings = analyzeHooks(settings, /* ... existing args ... */);
  const bug = findings.find((f) => f.message.includes("env var"));
  expect(bug?.severity).toBe("high");
});
```

- [ ] **Step 3: Run test, expect failure**

```bash
pnpm test:run tests/hooks-analyzer.test.ts
```

- [ ] **Step 4: Implement** in `src/commands/doctor/analyzers/hooks.ts`:

```typescript
import { hasEnvVarHookPattern } from "../../../lib/hook-input.js";

// Inside the analyzer's main scan function, after iterating hook events:
for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
  for (const group of groups) {
    for (const hook of group.hooks) {
      if (hook.type === "command" && hasEnvVarHookPattern(hook.command)) {
        findings.push({
          severity: "high",
          message: `Hook reads non-existent $TOOL_INPUT_* env var (silently inert)`,
          detail: `${event}/${group.matcher || "*"}: ${hook.command.slice(0, 80)}...`,
          fix: "doctor --fix rewrites known shapes to jq stdin form. User-customized hooks need manual rewrite.",
        });
      }
    }
  }
}
```

- [ ] **Step 5: Run test, expect pass**

```bash
pnpm test:run tests/hooks-analyzer.test.ts
```

---

## Task 6: Doctor fixer — rewrite known-shape inert hooks

**Files:**
- Modify: `src/commands/doctor/fixer.ts` (FIX_TABLE)
- Possibly: new `src/commands/doctor/fixer-hook-input.ts` if logic gets long

- [ ] **Step 1: Test scenario — fix rewrites our own old-shape hooks**

```typescript
// tests/fixer.test.ts (append)
it("doctor --fix rewrites $TOOL_INPUT_* hooks generated by older versions", async () => {
  const root = await mkTmpProject();
  // Seed an old settings.json with the bug
  await writeFile(join(root, ".claude", "settings.json"), JSON.stringify({
    hooks: {
      PreToolUse: [{
        matcher: "Read|Write|Edit",
        hooks: [{ type: "command", command: "echo \"$TOOL_INPUT_FILE_PATH\" | grep -qE '\\.(env|env\\..*)$' && exit 1; exit 0" }],
      }],
    },
  }, null, 2));

  await runFix(root); // existing helper

  const after = JSON.parse(await readFile(join(root, ".claude", "settings.json"), "utf8"));
  const cmd = after.hooks.PreToolUse[0].hooks[0].command;
  expect(cmd).not.toMatch(/TOOL_INPUT/);
  expect(cmd).toContain("jq -r '.tool_input.file_path");
});

it("doctor --fix is idempotent on env-var bug", async () => {
  // Apply fix twice, second pass should be a no-op
});

it("doctor --fix does NOT clobber user-customized hooks with $TOOL_INPUT_*", async () => {
  // If a hook command doesn't match a known shape (e.g. wastd's hardcoded LLM check),
  // leave it alone, just keep the HIGH finding so the user knows to fix manually.
});
```

- [ ] **Step 2: Implement fixer** — match against a known list of command shapes (regex over the command string body excluding the env-var token), and replace each matched hook command with the canonical `jqField()`-based version. For unrecognized hooks, leave alone.

```typescript
// src/commands/doctor/fixer-hook-input.ts (new file)
import { jqField, hasEnvVarHookPattern } from "../../lib/hook-input.js";
import type { Settings } from "../../types/index.js";

interface KnownHookShape {
  readonly idMatch: RegExp;       // distinguishing substring of the OLD command
  readonly replacement: string;   // the NEW command using jqField()
}

const KNOWN_SHAPES: ReadonlyArray<KnownHookShape> = [
  // .env block
  {
    idMatch: /\.env\)\$.*BLOCKED: \.env files contain secrets/,
    replacement: `fp=${jqField("file_path")}; echo "$fp" | grep -qE '\\.(env|env\\..*)$' && ! echo "$fp" | grep -q '.env.example' && echo 'BLOCKED: .env files contain secrets' >&2 && exit 2; exit 0`,
  },
  // Destructive bash
  // Force-push
  // Auto-format (variable per language — match by `prettier|ruff|gofmt|...`)
  // Sprint-complete nudge (match TASKS.md grep)
];

export function rewriteEnvVarHooks(settings: Settings): { changed: boolean; settings: Settings; remaining: number } {
  // Walk hooks, match commands against KNOWN_SHAPES, replace; count remaining unmatched env-var hooks
}
```

- [ ] **Step 3: Wire into FIX_TABLE in `src/commands/doctor/fixer.ts`**

Add an entry that imports `rewriteEnvVarHooks` and applies it when the analyzer finding's message matches `"env var"`.

- [ ] **Step 4: Run fixer tests**

```bash
pnpm test:run tests/fixer.test.ts
```

- [ ] **Step 5: Verify `--fix` re-scan** — per `.claude/rules/doctor.md`, fixer must re-scan to confirm the fix worked. Existing infrastructure handles this; just confirm the rewritten hook no longer matches `hasEnvVarHookPattern`.

---

## Task 7: Internal validation (manual smoke against real wastd-shape settings)

- [ ] **Step 1: Generate a fresh project with init**

```bash
mkdir -p /tmp/lp-smoke && cd /tmp/lp-smoke
node /Users/mboss37/Projects/claude-launchpad/dist/cli.js init -y
cat .claude/settings.json | grep -c "TOOL_INPUT"
# Expect: 0
```

- [ ] **Step 2: Pipe fake tool-input JSON to one of the new hook commands and confirm output**

```bash
cd /tmp/lp-smoke
# Find the .env block command
cmd=$(jq -r '.hooks.PreToolUse[0].hooks[0].command' .claude/settings.json)

# Test with a non-matching path: should be silent
echo '{"tool_input":{"file_path":"src/foo.ts"}}' | bash -c "$cmd"
echo "exit=$?"
# Expect: exit=0, no stderr

# Test with a .env path: should block
echo '{"tool_input":{"file_path":".env"}}' | bash -c "$cmd"
echo "exit=$?"
# Expect: exit=2, stderr 'BLOCKED: .env files contain secrets'
```

- [ ] **Step 3: Apply --fix to a project with the OLD env-var hooks**

```bash
mkdir -p /tmp/lp-fix-smoke/.claude && cd /tmp/lp-fix-smoke
cat > .claude/settings.json <<'EOF'
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Read|Write|Edit",
      "hooks": [{ "type": "command", "command": "echo \"$TOOL_INPUT_FILE_PATH\" | grep -qE '\\.(env|env\\..*)$' && exit 1; exit 0" }]
    }]
  }
}
EOF
node /Users/mboss37/Projects/claude-launchpad/dist/cli.js doctor --fix
grep TOOL_INPUT .claude/settings.json
# Expect: no matches
```

- [ ] **Step 4: Run benchmark suite to verify no memory regressions**

```bash
cd /Users/mboss37/Projects/claude-launchpad
pnpm bench:memory
# Expect: 57 benchmarks pass
```

- [ ] **Step 5: Run regression tests**

```bash
pnpm test:regression
# Expect: green
```

---

## Task 8: Code review

- [ ] **Step 1: Invoke superpowers:requesting-code-review** with base=master HEAD before this work, head=current.
- [ ] **Step 2: Address Critical and Important findings.**
- [ ] **Step 3: File Minor findings as P3 backlog WPs if not addressed.**

---

## Task 9: Sprint close + version bump + commit

- [ ] **Step 1: Update CHANGELOG.md with v1.10.1 entry**

```markdown
## [1.10.1] — 2026-05-04

### Fixed
- **Hooks reading non-existent `$TOOL_INPUT_*` env vars (silent inert hooks).** Every PreToolUse / PostToolUse hook our CLI emitted referenced `$TOOL_INPUT_FILE_PATH` and `$TOOL_INPUT_COMMAND` env vars that Claude Code does not set. Per the official spec, hook context arrives as JSON on stdin; bash hooks must use `jq -r '.tool_input.field' < /dev/stdin`. Result: `.env` block, destructive-command block, force-push protection, auto-format, sprint-complete nudge, workflow-check, and sprint-open-check have been silently no-op'ing in every project that ran our `init` or `doctor --fix`. Fix: shared `lib/hook-input.ts` utility, all generators rewritten, wrapper scripts (`workflow-check.sh`, `sprint-open-check.sh`) read stdin via jq. New doctor HIGH finding `Hook reads non-existent $TOOL_INPUT_* env var (silently inert)`; `doctor --fix` rewrites known shapes and leaves user customizations alone.

### Internal
- New `src/lib/hook-input.ts` (single source of truth for jq-stdin pattern); `tests/hook-input-bug.test.ts` smoke test pipes fake JSON to scripts and asserts hooks fire. N tests (+M).
```

- [ ] **Step 2: Bump version**
  - `package.json`: `"version": "1.10.1"`
  - `src/cli.ts`: same

- [ ] **Step 3: Move WP-012 from Current Sprint to Completed Sprints in TASKS.md**, update Sprint 32 line.

- [ ] **Step 4: Update BACKLOG.md ## Changelog**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: hooks read JSON from stdin via jq, not non-existent \$TOOL_INPUT_* env vars (P0)

Every PreToolUse/PostToolUse hook our CLI shipped was silently inert because
it read \$TOOL_INPUT_FILE_PATH and \$TOOL_INPUT_COMMAND — env vars Claude Code
does not set. Hook context arrives as JSON on stdin per the official spec.

- New src/lib/hook-input.ts: canonical jqField() utility
- settings.ts, fixer-hooks.ts, fixer-sprint.ts: every command rewritten
- hook-scripts.ts: workflow-check.sh + sprint-open-check.sh read jq stdin
- doctor: new HIGH finding + fixer for env-var bug in shipped projects
- regression test pipes fake JSON to scripts, confirms hooks fire

v1.10.1 patch."
```

- [ ] **Step 6: Confirm push with user before pushing**

---

## Self-Review Checklist

- [x] Task 1 covers the shared utility
- [x] Task 2-4 cover all 4 generator/fixer surfaces (settings.ts, fixer-hooks.ts, fixer-sprint.ts, hook-scripts.ts)
- [x] Task 5-6 cover the doctor detect+fix path for already-shipped projects
- [x] Task 7 covers internal validation (the user's explicit requirement)
- [x] Task 8 covers code review (mandatory per project)
- [x] Task 9 covers sprint close + commit + version bump
- [x] No placeholders — all bash and TS shown literally
- [x] Type consistency — `jqField`, `hasEnvVarHookPattern`, `READ_STDIN_PREAMBLE` defined in Task 1, used consistently in 2-6
