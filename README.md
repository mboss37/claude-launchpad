# Claude Launchpad

[![npm version](https://img.shields.io/npm/v/claude-launchpad?style=flat-square)](https://www.npmjs.com/package/claude-launchpad)
[![npm downloads](https://img.shields.io/npm/dm/claude-launchpad?style=flat-square)](https://www.npmjs.com/package/claude-launchpad)
[![GitHub stars](https://img.shields.io/github/stars/mboss37/claude-launchpad?style=flat-square)](https://github.com/mboss37/claude-launchpad)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](https://github.com/mboss37/claude-launchpad/blob/master/LICENSE)
![macOS](https://img.shields.io/badge/macOS-supported-brightgreen?style=flat-square&logo=apple)
![Linux](https://img.shields.io/badge/Linux-supported-brightgreen?style=flat-square&logo=linux)
![Windows](https://img.shields.io/badge/Windows-untested-yellow?style=flat-square&logo=windows)

**Claude follows CLAUDE.md ~80% of the time. Hooks run at 100%. Most setups have zero hooks.**

Claude Launchpad adds the hooks, scores your config, and tests that Claude actually follows your rules.

For developers using Claude Code who want consistent results: solo devs, vibe coders, AI-first teams.

## Install and See Your Score

```bash
npx claude-launchpad
```

```
  Instruction Budget     ━━━━━━━━━━━━━━━━━━━━   100%
  CLAUDE.md Quality      ━━━━━━━━━━━━━━━━━━━━   100%
  Settings               ━━━━━━━━━━━━━━━━━━━━   100%
  Hooks                  ━━━━━━━━━━━━━━━━━━━━   100%
  Rules                  ━━━━━━━━━━━━━━━━━━━━   100%
  Permissions            ━━━━━━━━━━━━━━━━━━━━   100%
  MCP Servers            ━━━━━━━━━━━━━━━━━━━━   100%

  Overall                ━━━━━━━━━━━━━━━━━━━━   100%

  ✓ No issues found. Your configuration looks solid.
```

A typical unconfigured project scores ~31%. After `--fix`, it jumps to ~91%.

## Quick Start

**New project:**

```bash
npx claude-launchpad init
```

Detects your stack, generates config, hooks, and permissions. Start at ~93%.

**Existing project:**

```bash
npx claude-launchpad doctor --fix
```

Scores your config, auto-repairs everything it can.

## The Three-File System

Without structure, CLAUDE.md becomes a dumping ground:

- Future ideas bury active guidance
- Sprint notes push conventions off-screen  
- Past ~200 lines, Claude starts ignoring rules at the bottom

The three-file split keeps each concern where it belongs:

| File | Purpose | Example |
|---|---|---|
| `CLAUDE.md` | What Claude needs to know | Stack, commands, conventions, guardrails |
| `TASKS.md` | What we're doing now | Current sprint, session log, progress |
| `BACKLOG.md` | What we're doing later | Parked features with P0/P1/P2 priority tiers |

Init generates all three. Doctor checks for them. `--fix` creates any that are missing.

## Commands

| Command | What it does | Runs |
|---|---|---|
| `claude-launchpad` | Score your config (routes to doctor) | Locally, free |
| `claude-launchpad init` | Detect stack, generate config + hooks + permissions | Locally, free |
| `claude-launchpad doctor --fix` | Auto-fix issues found by doctor | Locally, free |
| `claude-launchpad eval` | Run Claude against test scenarios, score results | Via Claude CLI |
| `claude-launchpad memory` | Optional knowledge base that persists across sessions | Locally |
| `/lp-enhance` (skill) | Claude reads your code and completes CLAUDE.md | Inside Claude Code |

## Doctor

Runs 7 analyzers against your `.claude/` directory and CLAUDE.md. No API calls, no network, no cost.

**Analyzers:**

| Analyzer | What it catches |
|---|---|
| **Instruction Budget** | Too many instructions. Claude starts ignoring rules past ~200. |
| **CLAUDE.md Quality** | Missing sections, vague instructions, hardcoded secrets |
| **Settings** | No hooks configured, dangerous tool access without safety nets |
| **Hooks** | Missing auto-format, no .env protection, no PostCompact hook, no auto-sync on session end |
| **Rules** | Dead rule files, stale references, empty configs |
| **Permissions** | Credential exposure (~/.ssh, ~/.aws), blanket Bash approval, sandbox disabled |
| **MCP Servers** | Invalid transport configs, missing commands/URLs |

An optional Memory analyzer runs when agentic memory is detected.

**Flags:**

| Flag | What it does |
|---|---|
| `--fix` | Auto-fix: adds hooks, CLAUDE.md sections, BACKLOG.md, rules, .claudeignore |
| `--fix --dry-run` | Preview fixes without applying them |
| `--watch` | Re-runs every second as you edit config files |
| `--json` | Pure JSON output for scripts and CI |
| `--min-score <n>` | Exit code 1 if score is below threshold (for CI) |
| `-p, --path <dir>` | Run on a different directory |

## Init

Reads your manifest files (package.json, go.mod, pyproject.toml, etc.) and generates config that fits. No templates, no menus.

```
  → Detecting project...
  ✓ Found Next.js project
  · Package manager: pnpm

  ✓ Generated CLAUDE.md
  ✓ Generated TASKS.md
  ✓ Generated BACKLOG.md
  ✓ Generated .claude/settings.json (schema, permissions, hooks)
  ✓ Generated .claude/.gitignore
  ✓ Generated .claudeignore
  ✓ Generated .claude/rules/conventions.md
```

**What init writes:**
- Always: `CLAUDE.md`, `TASKS.md`, `BACKLOG.md`, `.claude/settings.json`
- Creates when missing: `.claude/.gitignore`, `.claudeignore`, `.claude/rules/conventions.md`
- Offers `/lp-enhance` install (project/global/skip) if not already present
- CLAUDE.md includes a "When Stuck" stop-and-swarm rule: after 3 failed attempts, Claude spins up parallel agents instead of retrying the same approach

**Supported stacks:** TypeScript, JavaScript, Python, Go, Ruby, Rust, Dart, PHP, Java, Kotlin, Swift, Elixir, C#. Detects frameworks: Next.js, FastAPI, Django, Rails, Laravel, Express, SvelteKit, Angular, NestJS, and 15+ more.

## Enhance

Init detects your stack but cannot read your architecture. The `/lp-enhance` skill runs inside Claude Code to fill in the details.

```
/lp-enhance
```

Claude reads your codebase and updates CLAUDE.md with real content: actual architecture, actual conventions, actual guardrails. Not boilerplate. It also suggests project-specific hooks and MCP servers.

Stays under the 200-instruction budget. Overflows detailed content to `.claude/rules/` files. If the skill is missing, `doctor --fix` will create it.

**When to re-run:** after major refactors, new dependencies, or architecture changes.

## Eval

Runs Claude against real test scenarios and scores the results.

```bash
# Interactive mode (pick suite, runs, model)
claude-launchpad eval

# Or pass flags directly
claude-launchpad eval --suite security --runs 1 --model haiku
```

Each scenario creates an isolated sandbox with your full Claude Code config copied in. It runs Claude with a task and checks if your configuration made Claude follow the rules.

```
  ✓ security/sql-injection            10/10  PASS
  ✓ security/env-protection           10/10  PASS
  ✓ security/secret-exposure          10/10  PASS
  ✓ security/input-validation         10/10  PASS
  ✗ conventions/file-size              5/10  FAIL
    ✗ Claude kept all generated files under 800 lines

  Config Eval Score      ━━━━━━━━━━━━━━━━━━━─    95%
```

Results save to `.claude/eval/` as structured markdown. Feed them back to Claude to fix failures.

**Suites:**

| Suite | Scenarios | What it tests |
|---|---|---|
| `security` | 6 | SQL injection, .env protection, secret exposure, input validation, credential read, sandbox escape |
| `conventions` | 5 | Error handling, immutability, file size, naming, no hardcoded values |
| `workflow` | 4 | Git conventions, session continuity, memory persistence, deferred tracking |

**Flags:**

| Flag | What it does |
|---|---|
| `--suite <name>` | Run one suite: `security`, `conventions`, or `workflow` |
| `-p, --path <dir>` | Project root to evaluate (defaults to cwd) |
| `--scenarios <path>` | Use a custom scenarios directory |
| `--model <model>` | Model to use: `haiku`, `sonnet`, `opus` |
| `--runs <n>` | Runs per scenario (default 3, median score used) |
| `--debug` | Keep sandbox directories for inspection |
| `--json` | JSON output |
| `--timeout <ms>` | Timeout per run (default 120000) |

## Memory

Claude's built-in memory resets per machine. Launchpad gives each project persistent, cross-device memory that syncs via a private GitHub Gist. Switch laptops and your decisions are already there.

```bash
claude-launchpad memory
```

If memory is not installed, it runs interactive setup. If installed, it shows stats. Requires native deps first: `npm install better-sqlite3 sqlite-vec`.

During setup, you choose where memory config lives:

- **Shared** (default) — config goes to `CLAUDE.md` + `settings.json` (committed, team sees it)
- **Local** — config goes to `.claude/CLAUDE.md` + `settings.local.json` (gitignored, only you)

Use "local" when co-devs have different memory setups (e.g. you use agentic-memory, they use built-in). Your choice is persisted so `doctor --fix` won't re-ask.

Every session, Claude loads what it needs to know and stores new knowledge as it works. Stale facts fade on their own. Knowledge Claude actually uses gets reinforced. Each project has its own isolated memory. When a session ends, memories auto-sync to a private GitHub Gist so they're available on any machine.

Browse everything with `--dashboard`, a terminal UI with vim navigation, filtering, and search.

Data stays in `~/.agentic-memory/memory.db`. Sync requires the [GitHub CLI](https://cli.github.com/) (`gh`).

| Flag / Subcommand | What it does |
|---|---|
| `--dashboard` | Opens the interactive TUI dashboard |
| `push` | Push current project's memories to a private GitHub Gist |
| `pull` | Pull current project's memories from a private GitHub Gist |
| `push --all` | Push all projects |
| `pull --all` | Pull all projects |
| `push -y` | Skip confirmation prompt |
| `sync status` | Show local vs remote memory counts |
| `sync clean <project>` | Remove a project from the sync gist |

Sync stores one file per project inside a single private gist. Push/pull auto-detects the current project from your working directory. On a new device, the gist is auto-discovered from your GitHub account (no config to copy).

## Use in CI

Block PRs that degrade your Claude Code config quality:

```yaml
# .github/workflows/claude-config.yml
name: Claude Code Config Quality
on:
  pull_request:
    paths: ['CLAUDE.md', '.claude/**', '.claudeignore']
jobs:
  config-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npx claude-launchpad@latest doctor --min-score 80 --json
```

Score below threshold = exit code 1 = PR blocked.

## Glossary

New to Claude Code? Here's what the terms mean.

| Term | What it is |
|---|---|
| **CLAUDE.md** | A markdown file in your project root that tells Claude how to work on your code. Think of it as instructions for your AI pair programmer. [Official docs](https://docs.anthropic.com/en/docs/claude-code/memory#claudemd) |
| **TASKS.md** | Sprint tracker and session log. Claude reads this at session start to pick up where you left off. |
| **BACKLOG.md** | Where deferred features live. Priority tiers (P0/P1/P2) keep future ideas organized without cluttering TASKS.md. |
| **Hooks** | Shell commands that run automatically when Claude does something. CLAUDE.md rules are ~80% reliable. Hooks are 100% enforced. A SessionStart hook that runs `cat TASKS.md` means Claude sees your task list at every session start. |
| **Instruction budget** | CLAUDE.md has a soft limit of ~200 actionable lines. Past that, Claude starts ignoring rules at the bottom. Doctor counts your lines and warns you. |
| **Rules** | Extra markdown files in `.claude/rules/` that Claude reads alongside CLAUDE.md. Use them to offload detailed conventions so CLAUDE.md stays under budget. |
| **Compaction** | When a conversation gets too long, Claude compresses older messages. Without a PostCompact hook, Claude loses track of your sprint and session context mid-work. The hook re-injects TASKS.md after compaction so Claude stays on track. |
| **MCP Servers** | External tools Claude can connect to (databases, APIs, docs). Configured in `.mcp.json` (project scope) or `.claude/settings.json`. Most projects don't need them. |
| **.claudeignore** | Like `.gitignore` but for Claude. Tells Claude which files to skip so it doesn't waste time reading noise. |

## Privacy

- No telemetry, no analytics, no data sent anywhere
- Doctor, init, and fix run fully offline
- Memory stores data locally at `~/.agentic-memory/`
- Sync (`memory push/pull`) uses a private GitHub Gist under your account
- Enhance and eval run through your local Claude CLI

[Full privacy policy](https://mboss37.github.io/claude-launchpad/privacy.html).

## License

MIT
