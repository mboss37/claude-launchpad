# Cursor Agent Support Design

**Date:** 2026-08-30

**Status:** Approved direction, implementation not started

## Goal

Extend Claude Launchpad from a Claude Code-only configuration toolkit into a toolkit that can scaffold, diagnose, evaluate, and connect local memory to both Claude Code and Cursor Agent without regressing existing Claude Code behavior.

## Product Boundary

Cursor is an agent development and orchestration platform. Cursor Agent is its first-party harness across the IDE, CLI, SDK, and cloud. Claude Code and Codex remain separate harnesses even when launched from Cursor.

Launchpad does not own an agent loop and is not itself a harness. It owns:

- project configuration intent
- static validation and deterministic repair
- portable Agent Skills and MCP tools
- behavioral evaluation scenarios
- harness-specific adapters over documented public interfaces

The CLI option is therefore `--harness`, not `--model` or `--ide`.

## Supported Harnesses and Runtimes

The first implementation supports:

- `claude`: current Claude Code behavior
- `cursor`: local Cursor Agent in the IDE, Cursor CLI, or Cursor SDK
- `both`: both configuration surfaces in one repository
- `auto`: detect configured harnesses for read-only commands

Cursor Cloud configuration is diagnosed where public repository files have documented cloud behavior. Cursor Cloud memory parity is excluded because local SQLite state and `sessionStart` / `sessionEnd` lifecycle semantics do not transfer faithfully to cloud VMs.

## Compatibility Baseline

Cursor can already consume these Claude Code artifacts when third-party configuration is enabled:

- root `CLAUDE.md`
- `.claude/skills/`
- `.claude/agents/`
- supported hooks in `.claude/settings.json`

This is a migration bridge, not the native target. Launchpad will certify the compatible subset with live tests, then generate native Cursor files for unsupported or weaker surfaces.

## Architecture

### Harness registry

Add a typed harness layer:

```typescript
export type HarnessId = "claude" | "cursor";
export type HarnessSelection = HarnessId | "auto" | "both";

export interface HarnessProfile<TConfig extends ClaudeConfig | CursorConfig> {
  readonly id: HarnessId;
  readonly displayName: string;
  detect(projectRoot: string): Promise<boolean>;
  parse(projectRoot: string): Promise<TConfig>;
}
```

The Claude profile wraps existing behavior first. It is the regression oracle. The Cursor profile is added without converting every existing Claude analyzer into a lowest-common-denominator abstraction.

### Shared intent, harness renderers

Keep one source of truth for:

- detected stack and commands
- TASKS.md and BACKLOG.md
- workflow, verification, security, and review intent
- Agent Skill body content
- reviewer prompt content
- hook policy intent

Render harness-specific paths, frontmatter, schemas, events, matchers, and JSON envelopes.

Do not maintain two independently authored prose copies.

### Cursor project surface

Cursor initialization generates:

- `AGENTS.md`
- `TASKS.md`
- `BACKLOG.md`
- `.cursor/rules/conventions.mdc`
- `.cursor/rules/workflow.mdc`
- `.cursor/rules/hooks.mdc`
- `.cursor/rules/verification.mdc`
- `.cursor/agents/code-reviewer.md`
- `.cursor/skills/lp-enhance/SKILL.md`
- `.cursor/hooks.json`
- `.cursor/hooks/*.sh`
- `.cursorignore`

Memory installation additionally writes `.cursor/mcp.json`.

No generic `.cursor/sandbox.json` is generated because a safe network allowlist is project-specific. Doctor validates an existing sandbox file and recommends one when it can derive a concrete need.

### Dual-harness repositories

`--harness both` generates each harness from shared content builders. Launchpad markers identify generated sections and versions. Doctor reports divergence between Launchpad-managed equivalents but never overwrites an unmarked user-authored file.

Existing projects are additive:

- never replace `CLAUDE.md` with `AGENTS.md`
- never overwrite an existing `.cursor` artifact without a Launchpad version marker
- merge hooks and MCP servers by stable identity
- preserve unrelated configuration keys and entries

## CLI Behavior

### `init`

```text
claude-launchpad init --harness claude
claude-launchpad init --harness cursor
claude-launchpad init --harness both
```

Default remains `claude` for backward compatibility. `--yes` never changes the default harness.

### `doctor`

```text
claude-launchpad doctor --harness auto
claude-launchpad doctor --harness cursor
claude-launchpad doctor --harness both
```

Default is `auto`:

- one detected harness: analyze it
- both detected: print separate Claude and Cursor reports
- none detected: retain the current setup guidance and exit non-zero

Scores remain separate. Launchpad must not average Claude permission checks with Cursor sandbox or hook checks.

Cursor doctor ships read-only analysis before Cursor `--fix`. This prevents a new parser and new fixer from failing together without an observable baseline.

### `eval`

```text
claude-launchpad eval --harness claude
claude-launchpad eval --harness cursor
```

If both harnesses are configured and `--harness` is omitted, eval exits with an actionable ambiguity error.

Cursor eval uses `@cursor/sdk` local runtime with:

- explicit local `cwd`
- `local.settingSources: ["project"]`
- a discovered or user-selected model ID
- sandboxing enabled when supported
- structured stream capture

Cursor CLI headless mode is the fallback. Every result records harness, runtime, Cursor version, model ID and parameters, config sources, scenario runs, and timestamp.

Raw SDK tool payloads are not a stable contract. Normalize transcripts into stable events before transcript checks:

```typescript
export type CanonicalEvent =
  | { readonly kind: "tool"; readonly name: string; readonly summary: string }
  | { readonly kind: "shell"; readonly command: string }
  | { readonly kind: "blocked"; readonly reason: string }
  | { readonly kind: "text"; readonly role: "user" | "assistant"; readonly content: string }
  | { readonly kind: "error"; readonly message: string };
```

Artifact checks stay shared. Behavioral scenarios may declare supported harnesses when an equivalent policy cannot exist.

### `memory install`

```text
claude-launchpad memory install --harness cursor
```

The storage, retrieval, decay, sync, dashboard, benchmarks, and stdio MCP server remain unchanged.

The Cursor adapter:

- writes or merges `.cursor/mcp.json`
- installs local `sessionStart` context and pull hooks
- installs a local `sessionEnd` push hook only after a live lifecycle test proves completion
- emits Cursor `additional_context` instead of Claude `hookSpecificOutput.additionalContext`
- writes memory guidance to `AGENTS.md`
- does not write Claude permission keys or require the `claude` CLI

Cursor Cloud memory remains explicitly unsupported in this release.

## Hook Translation

| Intent | Claude Code | Cursor Agent |
|---|---|---|
| Block `.env` reads | `PreToolUse` with `Read` matcher | `beforeReadFile` |
| Block risky shell | `PreToolUse` with `Bash` matcher | `beforeShellExecution` |
| Format edited files | `PostToolUse` with `Write|Edit` matcher | `afterFileEdit` |
| Inject workflow warning | `PostToolUse` plus `additionalContext` envelope | `postToolUse` plus `additional_context` |
| Check sprint after commit | `PostToolUse` with `Bash` matcher | `afterShellExecution` |
| Inject TASKS context | `SessionStart` | `sessionStart` |
| Memory sync | `SessionStart` / `SessionEnd` | local `sessionStart` / verified local `sessionEnd` |

Cursor security-critical hooks use `failClosed: true`. Shared scripts accept both input dialects only where that remains readable and testable. Otherwise each harness gets a thin wrapper over shared policy logic.

## Testing Strategy

Every implementation task follows red-green-refactor TDD.

Required layers:

1. Unit tests for harness selection, parsers, renderers, hook envelopes, mergers, analyzers, and fixers.
2. Cursor regression script that runs real generated files through `doctor`, `doctor --fix`, JSON output, and idempotency checks.
3. Cursor live canary using Cursor Agent CLI or SDK to prove rules and hooks affect behavior.
4. Existing Claude unit and regression suites remain green after every milestone.
5. Memory changes additionally require all 59 memory benchmarks.

Live tests record the Cursor version and avoid assertions against undocumented internal prompts, routing, tool payload fields, or model selection heuristics.

## Release Decomposition

### Milestone 1: Harness foundation, Cursor init, and read-only doctor

Produces useful native Cursor configuration and an honest score without mutation.

### Milestone 2: Cursor deterministic fixes and live configuration canary

Adds safe repair only after parser and analyzer behavior is proven.

### Milestone 3: Cursor evaluation adapter

Runs existing artifact scenarios and normalized behavioral scenarios through Cursor Agent.

### Milestone 4: Local Cursor memory adapter

Connects the portable MCP/SQLite engine to local Cursor Agent and gates release on memory benchmarks.

Each milestone is independently releasable and gets its own sprint, implementation plan, review, and verification.

## Non-Goals

- Renaming or forking the npm package in the first Cursor release
- Treating a selected model as a harness
- Supporting Codex configuration in the Cursor milestone
- Depending on Cursor's private system prompts, routing, indexing, or built-in tool schemas
- Provisioning Cursor Automations
- Claiming identical scores or behavior across harnesses
- Claiming Cursor Cloud memory parity

## Documentation Sources

- [Cursor Agent overview](https://cursor.com/docs/agent/overview)
- [Cursor Rules and AGENTS.md](https://cursor.com/docs/rules)
- [Cursor Hooks](https://cursor.com/docs/hooks)
- [Cursor third-party hooks](https://cursor.com/docs/reference/third-party-hooks)
- [Cursor Skills](https://cursor.com/docs/skills)
- [Cursor Subagents](https://cursor.com/docs/subagents)
- [Cursor MCP](https://cursor.com/docs/mcp)
- [Cursor TypeScript SDK](https://cursor.com/docs/sdk/typescript)
- [Cursor headless CLI](https://cursor.com/docs/cli/headless)
