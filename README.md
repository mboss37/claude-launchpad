# Claude Launchpad

**Everything you need to launch a project with Claude Code — and keep it healthy.**

A launchpad isn't just where you start. It's where you prepare, run checks, and make sure everything is ready before you go. Claude Launchpad does exactly that for your Claude Code setup:

- **Launch new projects** with production-ready Claude Code config from day one
- **Check existing projects** — score your config, find issues, auto-fix them
- **Prove it works** — run Claude against test scenarios and see if your rules are actually followed

```bash
npm i -g claude-launchpad
```

## Two Paths, One Tool

### Starting a new project?

```bash
claude-launchpad init
```

Detects your stack, generates `CLAUDE.md` with your commands and conventions, creates `TASKS.md` for sprint tracking and session continuity, sets up hooks for auto-formatting and `.env` protection, and adds a `.claudeignore` so Claude doesn't waste time reading `node_modules`.

Then run `enhance` to have Claude read your codebase and fill in the architecture, conventions, and guardrails with real, project-specific content — not boilerplate.

### Already have a project?

```bash
claude-launchpad
```

Scans your Claude Code config, gives you a score out of 100, and tells you exactly what's wrong. Run `--fix` to auto-apply fixes. Run `--watch` to see the score update live as you edit. Run `eval` to prove your config actually makes Claude behave.

## All Commands

| Command | What it does | Cost |
|---|---|---|
| `claude-launchpad init` | Launch a new project: detects stack, generates config, hooks, TASKS.md | Free |
| `claude-launchpad` | Check your config: score it 0-100, list issues | Free |
| `claude-launchpad doctor --fix` | Auto-fix issues: adds hooks, rules, missing sections, .claudeignore | Free |
| `claude-launchpad doctor --watch` | Live score that updates when you save config files | Free |
| `claude-launchpad enhance` | Claude reads your code and completes CLAUDE.md with real content | Uses Claude |
| `claude-launchpad eval --suite security` | Run Claude against test scenarios, prove your config works | Uses Claude |

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

## Glossary

New to Claude Code? Here's what the terms mean:

| Term | What it is |
|---|---|
| **CLAUDE.md** | A markdown file in your project root that tells Claude how to work on your code. Think of it as instructions for your AI pair programmer. [Official docs](https://docs.anthropic.com/en/docs/claude-code/memory#claudemd) |
| **Hooks** | Shell commands that run automatically when Claude does something. For example: auto-format a file after Claude edits it, or block Claude from reading your `.env` file. They live in `.claude/settings.json`. |
| **Instruction budget** | CLAUDE.md has a soft limit of ~150 actionable lines. Past that, Claude starts ignoring rules at the bottom. Doctor counts your lines and warns you. |
| **Rules** | Extra markdown files in `.claude/rules/` that Claude reads alongside CLAUDE.md. Use them to offload detailed conventions so CLAUDE.md stays under budget. |
| **MCP Servers** | External tools Claude can connect to (databases, APIs, docs). Configured in `.claude/settings.json`. Most projects don't need them. |
| **.claudeignore** | Like `.gitignore` but for Claude. Tells Claude which files to skip (node_modules, dist, lockfiles) so it doesn't waste time reading noise. |

## What Costs Money

| Command | Free? | Why |
|---|---|---|
| `claude-launchpad` | Yes | Reads local files only |
| `doctor --fix` | Yes | Writes local files only |
| `doctor --watch` | Yes | Polls local files only |
| `init` | Yes | Generates local files only |
| `enhance` | No | Opens a Claude session to read your codebase |
| `eval` | No | Runs Claude headless for each scenario (default: 3 runs per scenario) |

`enhance` and `eval` use your Claude Code subscription. Use `--runs 1` and `--model haiku` with eval to keep it light.

## Privacy

No telemetry. No analytics. No data sent anywhere. Doctor, init, and fix are fully offline. Enhance and eval run through your local Claude CLI — no data passes through this tool. [Full privacy policy](https://mboss37.github.io/claude-launchpad/privacy.html).

## License

MIT
