# Claude Launchpad

**A linter for your Claude Code configuration.** Scores your setup, auto-fixes issues, and tests if Claude actually follows your rules.

You write a `CLAUDE.md`, add some hooks, configure settings — but is any of it actually working? Claude Launchpad scans your config, gives you a score out of 100, fixes what's broken, and runs Claude against test scenarios to prove it.

```bash
npx claude-launchpad
```

That's it. One command. You get a score. You see what's wrong. You fix it.

## What It Does

| Command | What it does | Cost |
|---|---|---|
| `claude-launchpad` | Scans your config, scores it 0-100, lists issues | Free |
| `claude-launchpad doctor --fix` | Auto-fixes issues (adds hooks, rules, missing sections) | Free |
| `claude-launchpad doctor --watch` | Live score that updates when you edit config files | Free |
| `claude-launchpad init` | Detects your stack, generates config from scratch | Free |
| `claude-launchpad enhance` | Opens Claude to read your code and complete CLAUDE.md | Uses Claude |
| `claude-launchpad eval --suite security` | Runs Claude against test scenarios, proves your config works | Uses Claude |

## Quick Start

```bash
# Install
npm i -g claude-launchpad

# Go to any project with Claude Code
cd your-project

# See your score
claude-launchpad

# Fix everything it found
claude-launchpad doctor --fix

# See your new score
claude-launchpad
```

That takes you from ~42% to ~86% with zero manual work.

## The Doctor

The core of the tool. Runs 7 analyzers against your `.claude/` directory and `CLAUDE.md`:

| Analyzer | What it catches |
|---|---|
| **Instruction Budget** | Too many instructions in CLAUDE.md — Claude starts ignoring rules past ~150 |
| **CLAUDE.md Quality** | Missing sections, vague instructions ("write good code"), hardcoded secrets |
| **Settings** | No hooks configured, dangerous tool access without safety nets |
| **Hooks** | Missing auto-format on save, no .env file protection, no security gates |
| **Rules** | Dead rule files, stale references, empty configs |
| **Permissions** | Bash auto-allowed without security hooks, no force-push protection |
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
| `--fix` | Auto-fixes issues: adds hooks, CLAUDE.md sections, rules, .claudeignore |
| `--watch` | Re-runs every second, updates when you save a config file |
| `--json` | Pure JSON output, no colors, no banner — for scripts and CI |
| `--min-score <n>` | Exit code 1 if score is below threshold — use in CI to block bad configs |
| `-p, --path <dir>` | Run on a different directory |

## Init

Detects your project and generates Claude Code config that fits. No templates, no menus — it reads your manifest files and figures it out.

```
  → Detecting project...
  ✓ Found Next.js (TypeScript) project
  · Package manager: pnpm
  · Dev command: pnpm dev

  ✓ Generated CLAUDE.md
  ✓ Generated TASKS.md
  ✓ Generated .claude/settings.json (with hooks)
  ✓ Generated .claudeignore
```

**Works with:** TypeScript, JavaScript, Python, Go, Ruby, Rust, Dart, PHP, Java, Kotlin, Swift, Elixir, C# — and detects frameworks (Next.js, FastAPI, Django, Rails, Laravel, Express, SvelteKit, Angular, NestJS, and 15+ more).

**What you get:**
- `CLAUDE.md` — your stack, commands, conventions, guardrails
- `TASKS.md` — session continuity across Claude Code sessions
- `.claude/settings.json` — auto-format hooks and .env file protection
- `.claudeignore` — keeps Claude from reading node_modules, dist, lockfiles, etc.

## Enhance

Init detects your stack but can't understand your architecture. Enhance opens Claude to read your actual code and fill in the details.

```bash
claude-launchpad enhance
```

Claude reads your codebase and updates CLAUDE.md with real content — actual architecture, actual conventions, actual guardrails. Not boilerplate. It also suggests project-specific hooks and MCP servers based on what it finds.

Stays under the 120-instruction budget. Overflows detailed content to `.claude/rules/` files.

## Eval

The part nobody else has built. Runs Claude against real test scenarios and scores the results.

```bash
# Run only security tests (4 scenarios)
claude-launchpad eval --suite security

# Run only convention tests (5 scenarios)
claude-launchpad eval --suite conventions

# Run only workflow tests (2 scenarios)
claude-launchpad eval --suite workflow

# Run everything (11 scenarios)
claude-launchpad eval

# Use a cheaper model
claude-launchpad eval --suite security --model haiku

# One run per scenario (fastest)
claude-launchpad eval --suite security --runs 1
```

Each scenario creates an isolated sandbox, runs Claude with a task, and checks if Claude followed the rules:

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
| `security` | 4 | SQL injection, .env protection, secret exposure, input validation |
| `conventions` | 5 | Error handling, immutability, file size, naming, no hardcoded values |
| `workflow` | 2 | Git conventions, session continuity |

**All eval flags:**

| Flag | What it does |
|---|---|
| `--suite <name>` | Run one suite: `security`, `conventions`, or `workflow` |
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

## Plugin (pending marketplace review)

```bash
claude plugin install claude-launchpad
```

Then use `/launchpad:doctor`, `/launchpad:init`, `/launchpad:enhance`, `/launchpad:eval` inside Claude Code. The plugin nudges you to re-check your score when you edit config files.

## How It Works

**Doctor** reads your files and runs static analysis. No API calls. No network. No cost.

**Init** scans manifest files (package.json, go.mod, pyproject.toml, etc.), detects your stack, and generates config with safe, hardcoded formatter hooks — never interpolates user-controlled strings.

**Enhance** spawns `claude "prompt"` as an interactive child process. You see Claude's full UI. No data passes through the tool — it just launches Claude with a task.

**Eval** creates a temp directory, writes seed files from the scenario YAML, initializes a git repo, runs Claude via the Agent SDK (or falls back to CLI), then checks the output with grep/file assertions. Sandbox is cleaned up after (or preserved with `--debug`).

## Why This Exists

- **CLAUDE.md is advisory.** ~80% compliance. Claude might ignore your rules.
- **Hooks are deterministic.** 100% compliance. But most people have zero hooks.
- **Instruction budget is real.** Past ~150, compliance drops. Most people don't know they're over.
- **Nobody measures.** You can't improve what you can't measure.

This tool gives you a number. Fix the issues, re-run, watch the number go up.

## License

MIT
