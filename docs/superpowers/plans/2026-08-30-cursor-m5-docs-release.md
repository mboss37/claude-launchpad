# Cursor Milestone 5: Documentation Sweep and Package Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public Cursor story true, then ship one minor (`1.18.0`) to npm and GitHub.

**Architecture:** No new product surface. M2-M4 have already shipped init, `--fix`, eval, and local memory for Cursor on `master`. M5 removes leftover Claude-only wording from Cursor-generated files, rewrites the docs site and README to match that matrix, then follows the existing release checklist. GitHub Pages deploys automatically from `docs/**` on `master` via `.github/workflows/docs.yml`.

**Tech Stack:** TypeScript generators, Vitest, Fumadocs MDX, npm publish scripts, `gh` releases.

**Spec:** `docs/superpowers/specs/2026-08-30-cursor-agent-support-design.md`

## Global Constraints

- Milestones 1 through 4 are complete on `master` and their reviews are closed.
- Do not start this plan before M4 is done.
- Do not publish a Cursor release from M1, M2, M3, or M4.
- Do not claim Cursor Cloud memory support. Ever.
- Do not rename the npm package.
- Version is a minor (`1.18.0`): new harness flag and commands, no Claude default break.
- `package.json` and `src/cli.ts` versions must match; `scripts/verify-dist-version.mjs` must pass before publish.
- `publish:release` = `pnpm build && node scripts/verify-dist-version.mjs && npm publish --access public --tag latest`.
- Flip the TASKS.md Release Plan line after npm is verified. A publish without that edit is unfinished.

---

### Task 1: Cursor-generated files must not mention the Claude surface

**Files:**
- Modify: `src/commands/init/generators/tasks-md.ts`
- Modify: `src/commands/init/generators/backlog.ts`
- Modify: `src/harness/cursor/generators.ts`
- Modify: `src/harness/cursor/scaffold.ts` (only if TASKS/BACKLOG generators need a harness argument)
- Test: `tests/cursor-generators.test.ts`
- Test: `tests/cursor-init.test.ts`

**Interfaces:**
- Consumes: existing `generateTasksMd(options)`, `generateBacklogMd(options)`, `generateCursorHooksRule()`, `generateCursorWorkflowRule()`.
- Produces: the same functions, plus an optional `workflowRulePath` (or harness) argument so Cursor init writes `.cursor/rules/workflow.mdc` in the shared files.

- [ ] **Step 1: Write the failing tests**

Add to `tests/cursor-init.test.ts` and `tests/cursor-generators.test.ts`:

```typescript
it("Cursor-only scaffold has no Claude surface leftovers", async () => {
  const root = await mkdtemp(join(tmpdir(), "lp-cursor-honest-"));
  await scaffoldCursor(
    root,
    { name: "demo", description: "" },
    fixedDetectedProject,
  );
  const files = [
    "TASKS.md",
    "BACKLOG.md",
    ".cursor/rules/hooks.mdc",
    ".cursor/rules/workflow.mdc",
    ".cursor/agents/code-reviewer.md",
  ];
  for (const relative of files) {
    const body = await readFile(join(root, relative), "utf-8");
    expect(body, relative).not.toContain(".claude/");
    expect(body, relative).not.toContain("CLAUDE.md");
    expect(body, relative).not.toContain("Claude Code");
  }
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run: `pnpm exec vitest run tests/cursor-init.test.ts tests/cursor-generators.test.ts`
Expected: FAIL — `TASKS.md` still says `.claude/rules/workflow.md`; `hooks.mdc` is still titled "Claude Code Hook Authoring Rules".

- [ ] **Step 3: Make Cursor render harness-correct paths**

`generateTasksMd` / `generateBacklogMd` take a workflow-rule path defaulting to `.claude/rules/workflow.md`. Cursor scaffold passes `.cursor/rules/workflow.mdc`.

After `stripClaudeRuleChrome`, Cursor hook/workflow rule bodies replace:

- `# Claude Code Hook Authoring Rules` → `# Cursor Hook Authoring Rules`
- `.claude/settings.json` / `.claude/settings.local.json` → `.cursor/hooks.json`
- `paths:` examples → `globs:`
- Claude hook event names (`PreToolUse`, `SessionStart`, `PostToolUse`) → Cursor names (`beforeShellExecution`, `sessionStart`, `afterFileEdit`) only in the Cursor-rendered copy

Claude `init` output must stay byte-stable. Existing `tests/agent-instructions.test.ts` snapshot and Claude init tests stay green.

- [ ] **Step 4: Re-run the tests**

Run: `pnpm exec vitest run tests/cursor-init.test.ts tests/cursor-generators.test.ts tests/agent-instructions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/init/generators/tasks-md.ts src/commands/init/generators/backlog.ts src/harness/cursor/generators.ts src/harness/cursor/scaffold.ts tests/cursor-init.test.ts tests/cursor-generators.test.ts
git commit -m "fix(cursor): remove Claude-surface leftovers from Cursor init output"
```

---

### Task 2: Public docs match the shipped command matrix

**Files:**
- Modify: `README.md`
- Modify: `docs/content/docs/index.mdx`
- Modify: `docs/content/docs/init.mdx`
- Modify: `docs/content/docs/doctor.mdx`
- Modify: `docs/content/docs/enhance.mdx` (Cursor skill path `.cursor/skills/lp-enhance/`)
- Modify: `docs/content/docs/eval.mdx` (add `--harness cursor` if M3 shipped it)
- Modify: `docs/content/docs/memory.mdx` (local Cursor only; Cloud unsupported)
- Modify: `docs/content/docs/workflow.mdx` (both rule paths)

**Interfaces:**
- No code API. Docs must match the CLI that exists on `master` after M4.

- [ ] **Step 1: Inventory the real CLI**

Run from repo root and paste the results into the docs edits (do not invent flags):

```bash
node dist/cli.js init --help
node dist/cli.js doctor --help
node dist/cli.js eval --help
node dist/cli.js memory --help
```

- [ ] **Step 2: Rewrite the four user-facing pages**

Required facts on `index.mdx` and README:

- Install is still `npx claude-launchpad` (package name unchanged).
- `--harness claude|cursor|both|auto` with init default `claude`, doctor default `auto`.
- Cursor files: `AGENTS.md`, `.cursor/rules/*.mdc`, `.cursor/hooks.json`, `.cursorignore`.
- Command matrix table: init and doctor work for both; eval and memory work for local Cursor after M3/M4; Cursor Cloud memory is not supported.
- Scores are never averaged. `--min-score` gates each harness.

Required facts on `init.mdx`:

- Second file tree for `--harness cursor` next to the existing Claude tree.
- `--force` overwrites `CLAUDE.md` or `AGENTS.md` for the selected harness.

Required facts on `doctor.mdx`:

- Cursor analyzers (Instructions, Hooks, Rules, Security, MCP).
- `--fix` applies to Cursor after M2. Say so only if M2 actually shipped it.

- [ ] **Step 3: Grep the docs for stale "Claude-only" claims that M2-M4 made false**

Run: `rg -n "Claude-only|read-only|--fix is rejected|eval/memory remain Claude" README.md docs/content/docs`
Expected after the rewrite: those phrases appear only in CHANGELOG history, not in current how-to pages.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/content/docs/index.mdx docs/content/docs/init.mdx docs/content/docs/doctor.mdx docs/content/docs/enhance.mdx docs/content/docs/eval.mdx docs/content/docs/memory.mdx docs/content/docs/workflow.mdx
git commit -m "docs: describe Cursor as a first-class local harness"
```

---

### Task 3: Version, changelog, publish, tag, GitHub release

**Files:**
- Modify: `package.json` (`version`)
- Modify: `src/cli.ts` (`.version(...)`)
- Modify: `CHANGELOG.md`
- Modify: `TASKS.md` (Release Plan + Completed Sprints + Session Log)
- Modify: `docs/content/docs/changelog.mdx` (mirror the 1.18.0 entry)

**Interfaces:**
- Consumes: existing `pnpm publish:release`, `scripts/verify-dist-version.mjs`.
- Produces: npm `latest` = `1.18.0`, git tag `v1.18.0`, GitHub release.

- [ ] **Step 1: Bump the two version strings together**

Set both to `1.18.0`. Do not bump only one.

- [ ] **Step 2: Write CHANGELOG.md at the top**

```markdown
## [1.18.0] — 2026-MM-DD

Cursor Agent is a second local harness. One release after M1-M4.

### Added
- `--harness claude|cursor|both|auto` on init, doctor, eval, and memory.
- Cursor init: AGENTS.md, .cursor/rules/*.mdc, fail-closed hooks.json, hook scripts, .cursorignore, reviewer, lp-enhance.
- Cursor doctor with --fix (M2). Cursor eval (M3). Local Cursor memory via .cursor/mcp.json (M4).

### Changed
- Doctor --harness auto detects a real Cursor agent surface (AGENTS.md, hooks.json, or .mdc rules), not a bare .cursor directory.

### Not supported
- Cursor Cloud memory. Local SQLite + session hooks only.
```

Fill the Added bullets from what M2-M4 actually shipped. Delete any bullet that is not on `master`.

Mirror the same section in `docs/content/docs/changelog.mdx`.

- [ ] **Step 3: Verify before publish**

```bash
pnpm typecheck
pnpm test:run
pnpm bench:memory
pnpm test:regression
pnpm test:regression:cursor
pnpm build
node scripts/verify-dist-version.mjs
```

Expected: all green; `node dist/cli.js -v` prints `1.18.0`.

- [ ] **Step 4: Commit the release metadata**

```bash
git add package.json src/cli.ts CHANGELOG.md docs/content/docs/changelog.mdx TASKS.md
git commit -m "chore: release 1.18.0"
git push origin master
```

- [ ] **Step 5: Publish, tag, GitHub release**

```bash
pnpm publish:release
npm view claude-launchpad version
git tag v1.18.0 && git push origin v1.18.0
gh release create v1.18.0 --title "v1.18.0" --notes-file CHANGELOG.md
```

Expected: `npm view claude-launchpad version` is `1.18.0`. GitHub Pages rebuilds from the docs push.

- [ ] **Step 6: Flip TASKS.md and commit**

Release Plan line becomes `**v1.18.0** ✅ shipped YYYY-MM-DD`. Add one Completed Sprints line for the Cursor arc. Commit:

```bash
git add TASKS.md
git commit -m "chore: mark 1.18.0 shipped"
git push origin master
```

---

## Self-review

- Spec M5 (docs + one package release) is Tasks 1-3.
- No M2/M3/M4 feature work is in this plan.
- No placeholders. Version is `1.18.0`. Package name stays `claude-launchpad`.
- Do not execute this plan until M4 is closed.
