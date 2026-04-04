# Claude Launchpad

[![npm version](https://img.shields.io/npm/v/claude-launchpad?style=flat-square)](https://www.npmjs.com/package/claude-launchpad)
[![npm downloads](https://img.shields.io/npm/dm/claude-launchpad?style=flat-square)](https://www.npmjs.com/package/claude-launchpad)
[![GitHub stars](https://img.shields.io/github/stars/mboss37/claude-launchpad?style=flat-square)](https://github.com/mboss37/claude-launchpad)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](https://github.com/mboss37/claude-launchpad/blob/master/LICENSE)

**Score your Claude Code setup. Fix what's broken. Prove it works.**

CLAUDE.md is advisory, so Claude follows your rules about 80% of the time. Hooks are deterministic: 100% compliance. Most developers have zero hooks and too many instructions. This tool scores your setup, fixes the gaps, and proves Claude follows your config.

```bash
npx claude-launchpad
```

That's it. Run it in any project with Claude Code. You'll see a score out of 100 and a list of exactly what's wrong. Run `--fix` to auto-repair.

Claude Launchpad has 4 CLI commands (`init`, `doctor`, `eval`, `memory`) plus 1 in-session skill (`/lp-enhance`). Memory is optional.

## Two Paths, One Tool

### Starting a new project?

```bash
claude-launchpad init
```

Detects your stack and generates `CLAUDE.md` with your commands and conventions. Creates `TASKS.md` for tracking, `BACKLOG.md` for parking features, sets up hooks that auto-format and block dangerous operations, and adds `.claudeignore` for noise files.

Then use `/lp-enhance` inside Claude Code to have Claude read your actual codebase and fill in the architecture and guardrails — not boilerplate, real project-specific content.

### Already have a project?

```bash
claude-launchpad
```

Scores your config out of 100 and tells you what's wrong. Run `doctor --fix` for automatic repairs, `/lp-enhance` for AI-powered rewrites, and `eval` to prove behavior.

## Command Model

| Command | What it does | Runs |
|---|---|---|
| `claude-launchpad init` | Detect stack, generate config, hooks, permissions | Locally |
| `claude-launchpad` | Default entrypoint (routes to doctor when config exists) | Locally |
| `claude-launchpad doctor --fix` | Auto-fix issues: hooks, rules, sections, .claudeignore | Locally |
| `claude-launchpad doctor --watch` | Live score that updates when you save config files | Locally |
| `/lp-enhance` (skill) | Claude reads your code and completes CLAUDE.md | Inside Claude Code |
| `claude-launchpad eval` | Run Claude against test scenarios, prove config works | Via Claude CLI |
| `claude-launchpad memory` | Optional memory setup (or stats) + installs `/lp-migrate-memory` skill | Locally |
| `claude-launchpad memory --dashboard` | TUI dashboard for memory visualization | Locally |

## Quick Start

```bash
cd your-project
npx claude-launchpad            # see your score
npx claude-launchpad doctor --fix   # fix everything
```

A typical unconfigured project scores ~42%. After `--fix`, it jumps to ~86%. Run `init` on a fresh project and you start at ~93%.

## The Doctor

The core of the tool. Runs 7 core analyzers against your `.claude/` directory and `CLAUDE.md` (plus an optional Memory analyzer when agentic memory is detected):

| Analyzer | What it catches |
|---|---|
| **Instruction Budget** | Too many instructions in CLAUDE.md — Claude starts ignoring rules past ~200 |
| **CLAUDE.md Quality** | Missing essential sections, vague instructions ("write good code"), hardcoded secrets |
| **Settings** | No hooks configured, dangerous tool access without safety nets |
| **Hooks** | Missing auto-format on save, no .env file protection, no security gates, no PostCompact hook |
| **Rules** | Dead rule files, stale references, empty configs |
| **Permissions** | Credential file exposure (~/.ssh, ~/.aws, ~/.npmrc), blanket Bash approval, bypass mode unprotected, sandbox disabled, .env gap between hooks and .claudeignore, no force-push protection |
| **MCP Servers** | Invalid transport configs, missing commands/URLs |

Output looks like this:

```
  Instruction Budget     ━━━━━━━━━━━━━━━━━━━━   100%
  CLAUDE.md Quality      ━━━━━━━━━━━━━━━━━━━━   100%
  Settings               ━━━━━━━━━━━━━━━━━━━━   100%
  Hooks                  ━━━━━━━━━━━━━━━━━━━━   100%
  Rules                  ━━━━━━━━━━━━━━━━━━━━   100%
  Permissions            ━━━━━━━━━━━━━━━━━━━━   100%
  MCP Servers            ━━━━━━━━━━──────────    50%

  Overall                ━━━━━━━━━━━━━━━━━━━─    93%

  ✓ No issues found. Your configuration looks solid.
```

**All doctor flags:**

| Flag | What it does |
|---|---|
| `--fix` | Auto-fixes issues: adds hooks, CLAUDE.md sections, BACKLOG.md, rules, .claudeignore |
| `--fix --dry-run` | Preview what --fix would change without applying |
| `--watch` | Re-runs every second, updates when you save a config file |
| `--json` | Pure JSON output, no colors, no banner — for scripts and CI |
| `--min-score <n>` | Exit code 1 if score is below threshold — use in CI to block bad configs |
| `-p, --path <dir>` | Run on a different directory |

## Init

Detects your project and generates Claude Code config that fits. No templates, no menus — it reads your manifest files and figures it out.

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

**Works with:** TypeScript, JavaScript, Python, Go, Ruby, Rust, Dart, PHP, Java, Kotlin, Swift, Elixir, C# — and detects frameworks (Next.js, FastAPI, Django, Rails, Laravel, Express, SvelteKit, Angular, NestJS, and 15+ more).

**What init writes:**
- Always writes: `CLAUDE.md`, `TASKS.md`, `BACKLOG.md`, `.claude/settings.json`
- Creates when missing: `.claude/.gitignore`, `.claudeignore`, `.claude/rules/conventions.md`
- Offers `/lp-enhance` install (project/global/skip) only when no project/global/legacy install already exists

**The three-file system:**

| File | Purpose |
|---|---|
| `CLAUDE.md` | What Claude needs to know — stack, commands, conventions, guardrails |
| `TASKS.md` | What we're doing now — sprint tracking, session continuity |
| `BACKLOG.md` | What we're doing later — parked features with P0/P1/P2 priority tiers |

Without BACKLOG.md, deferred features get lost in conversation history or bloat TASKS.md. Init generates it, doctor checks for it, `--fix` creates it if missing.

## Enhance

Init detects your stack but can't understand your architecture. The `/lp-enhance` skill runs inside your Claude Code session to read your actual code and fill in the details.

```
/lp-enhance
```

Installed as a skill during `init` (you pick global or project scope). Claude reads your codebase and updates CLAUDE.md with real content - actual architecture, actual conventions, actual guardrails, and memory management instructions. Not boilerplate. It also suggests project-specific hooks (including PostCompact for session continuity) and MCP servers based on what it finds.

Stays under the 200-instruction budget. Overflows detailed content to `.claude/rules/` files. If the skill is missing, `doctor --fix` will create it.

## Memory

Optional persistent memory system that replaces Claude Code's built-in flat-file memory with intelligent, decay-based retrieval.

```bash
claude-launchpad memory
```

Requires native deps first: `npm install better-sqlite3 sqlite-vec` (the CLI will prompt you if missing). Interactive setup - asks before changing anything. Installs a SQLite database, hooks for automatic context injection, and 7 MCP tools.

**What it does:**
- **Smart session injection** - each session starts with the most relevant memories, ranked by 6 signals (context, value, importance, recency, type, noise) and packed into a 2000-token budget across three tiers (full content / summary / title-only)
- **Stop hook** extracts facts from the conversation transcript when you're done
- **Decay model** - memories fade naturally based on type (episodic: 60 days, semantic: 1 year, procedural: 2 years)
- **Self-tuning retrieval** - memories Claude actively searches for rise in rank; memories injected but never used gradually stop appearing
- **Project-scoped** - memories are partitioned per project, no cross-contamination
- **TUI dashboard** (`--dashboard`) for visualization with vim navigation, filtering, and search

No cloud. No sync. Everything stays in `~/.agentic-memory/memory.db`.

**Memory flags:**

| Flag | What it does |
|---|---|
| `--dashboard` | Opens the interactive TUI dashboard |

Default behavior of `claude-launchpad memory`:
- If memory is not installed, it runs interactive install
- If memory is installed, it shows memory stats

## Eval

The part nobody else has built. Runs Claude against real test scenarios and scores the results.

```bash
# Interactive mode — pick suite, runs, and model
claude-launchpad eval

# Or pass flags directly
claude-launchpad eval --suite security --runs 1 --model haiku
```

Each scenario creates an isolated sandbox with your full Claude Code config (settings.json, rules, hooks, .claudeignore) copied in, runs Claude with a task, and checks if your configuration made Claude follow the rules:

```
  ✓ security/sql-injection            10/10  PASS
  ✓ security/env-protection           10/10  PASS
  ✓ security/secret-exposure          10/10  PASS
  ✓ security/input-validation         10/10  PASS
  ✗ conventions/file-size              5/10  FAIL
    ✗ Claude kept all generated files under 800 lines

  Config Eval Score      ━━━━━━━━━━━━━━━━━━━─    95%
```

Results are saved to `.claude/eval/` as structured markdown — you can feed these reports back to Claude to fix the failures.

**Suites:**

| Suite | Scenarios | What it tests |
|---|---|---|
| `security` | 6 | SQL injection, .env protection, secret exposure, input validation, credential read, sandbox escape |
| `conventions` | 5 | Error handling, immutability, file size, naming, no hardcoded values |
| `workflow` | 4 | Git conventions, session continuity, memory persistence, deferred tracking |

**All eval flags:**

| Flag | What it does |
|---|---|
| `--suite <name>` | Run one suite: `security`, `conventions`, or `workflow` |
| `-p, --path <dir>` | Project root to evaluate (defaults to current directory) |
| `--scenarios <path>` | Use a custom scenarios directory |
| `--model <model>` | Model to use: `haiku`, `sonnet`, `opus` |
| `--runs <n>` | Runs per scenario (default 3, median score used) |
| `--debug` | Keep sandbox directories so you can inspect what Claude wrote |
| `--json` | JSON output |
| `--timeout <ms>` | Timeout per run (default 120000) |

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

## How It Works

**Doctor** reads your files and runs static analysis. No API calls. No network. No cost.

**Init** scans manifest files (package.json, go.mod, pyproject.toml, etc.), detects your stack, and generates 8 files: CLAUDE.md (with sprint reviews and backlog management), TASKS.md (with deferred issues section), BACKLOG.md (priority-tiered feature parking), settings.json (with credential deny rules, sandbox enabled, bypass mode disabled, hooks including sprint review and PostCompact), .claude/.gitignore, .claudeignore, /lp-enhance skill, and language-specific rules. Formatter hooks use hardcoded safe commands only.

**Enhance** is a `/lp-enhance` skill installed during `init`. It runs inside your active Claude Code session - no separate process, no overhead. Claude already has your codebase context, so it produces better results than an external command.

**Eval** creates a temp directory, copies your full `.claude/` config (settings.json, rules, hooks, permissions) and `.claudeignore` into it, writes seed files from the scenario YAML, initializes a git repo, runs Claude via the Agent SDK (or falls back to CLI), then checks the output with grep/file assertions. Your code is never copied, only your Claude Code configuration. Sandbox is cleaned up after (or preserved with `--debug`).

## Why This Exists

Nobody measures their Claude Code config quality. You write CLAUDE.md, hope Claude follows it, and never verify. This tool gives you a number. Fix the issues, re-run, watch it go up.

## Glossary

New to Claude Code? Here's what the terms mean:

| Term | What it is |
|---|---|
| **CLAUDE.md** | A markdown file in your project root that tells Claude how to work on your code. Think of it as instructions for your AI pair programmer. [Official docs](https://docs.anthropic.com/en/docs/claude-code/memory#claudemd) |
| **TASKS.md** | Sprint tracker and session log. Claude reads this at session start to pick up where you left off. |
| **BACKLOG.md** | Where deferred features live. Priority tiers (P0/P1/P2) keep future ideas organized without cluttering TASKS.md. |
| **Hooks** | Shell commands that run automatically when Claude does something. For example: auto-format a file after Claude edits it, or block Claude from reading your `.env` file. They live in `.claude/settings.json`. |
| **Instruction budget** | CLAUDE.md has a soft limit of ~200 actionable lines. Past that, Claude starts ignoring rules at the bottom. Doctor counts your lines and warns you. |
| **Rules** | Extra markdown files in `.claude/rules/` that Claude reads alongside CLAUDE.md. Use them to offload detailed conventions so CLAUDE.md stays under budget. |
| **Compaction** | When a Claude Code conversation gets too long, it compresses older messages to free up space. This can lose context — a PostCompact hook re-injects critical files (like TASKS.md) after compaction. |
| **MCP Servers** | External tools Claude can connect to (databases, APIs, docs). Configured in `.claude/settings.json`. Most projects don't need them. |
| **.claudeignore** | Like `.gitignore` but for Claude. Tells Claude which files to skip (node_modules, dist, lockfiles) so it doesn't waste time reading noise. |

## Privacy

No telemetry. No analytics. No data sent anywhere. Doctor, init, and fix are fully offline. Memory stores data locally at `~/.agentic-memory/` - no cloud sync. Enhance and eval run through your local Claude CLI - no data passes through this tool. [Full privacy policy](https://mboss37.github.io/claude-launchpad/privacy.html).

## License

MIT
