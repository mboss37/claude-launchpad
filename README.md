# Claude Launchpad

**Your Claude Code setup is probably broken. This tool tells you how.**

Claude Code's effectiveness is 90% configuration, 10% prompting. But nobody can tell if their config is actually good. You write a `CLAUDE.md`, add some hooks, install some plugins — and then *hope* Claude follows them.

Claude Launchpad is the first CLI that **diagnoses, scaffolds, enhances, and tests** Claude Code configurations. Think ESLint for your AI setup.

```bash
npx claude-launchpad
```

## The Workflow

```bash
npx claude-launchpad init          # 1. Auto-detect stack, generate config + hooks + .claudeignore
npx claude-launchpad enhance       # 2. Claude reads your code, completes CLAUDE.md
npx claude-launchpad               # 3. Check your score (42%)
npx claude-launchpad doctor --fix  # 4. Auto-fix everything (→ 86%)
npx claude-launchpad eval          # 5. Prove your config works (89% eval score)
```

> See the [full story on the landing page](https://mboss37.github.io/claude-launchpad/) — a 42% → 89% journey.

## Commands

### `doctor` — Know your score

Runs 7 static analyzers against your `.claude/` directory and `CLAUDE.md`. No API calls, no cost, works offline.

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

Running bare `claude-launchpad` with no subcommand auto-detects your config and runs doctor.

**Flags:**
- `--fix` — Auto-apply deterministic fixes (42% → 86% in one command)
- `--watch` — Live score that updates every time you save a config file
- `--json` — JSON output for programmatic use
- `--min-score <n>` — Exit non-zero if score drops below threshold (for CI)

**What it checks:**

| Analyzer | What it catches |
|---|---|
| **Instruction Budget** | Are you over the ~150 instruction limit where Claude starts ignoring rules? |
| **CLAUDE.md Quality** | Missing essential sections, vague instructions ("write good code"), hardcoded secrets |
| **Settings** | Hooks configured, dangerous tool access without safety nets |
| **Hooks** | Missing auto-format, no .env protection, no PreToolUse security gates |
| **Rules** | Dead rule files, stale references, empty configs |
| **Permissions** | Bash auto-allowed without security hooks, no force-push protection |
| **MCP Servers** | Invalid transport configs, missing commands/URLs, broken executables |

### `init` — Set up any project in seconds

Auto-detects your stack and generates optimized Claude Code configuration. Works with **any** language — no fixed menu, no templates to pick from.

```bash
claude-launchpad init
```

```
  → Detecting project...
  ✓ Found Next.js (TypeScript) project
  · Package manager: pnpm
  · Dev command: pnpm dev
  · Test command: pnpm test

  ✓ Generated CLAUDE.md
  ✓ Generated TASKS.md
  ✓ Generated .claude/settings.json (with hooks)
  ✓ Generated .claudeignore
```

**Detects 13 languages:** TypeScript, JavaScript, Python, Go, Ruby, Rust, Dart, PHP, Java, Kotlin, Swift, Elixir, C#

**Detects 20+ frameworks:** Next.js, FastAPI, Django, Rails, Laravel, Express, SvelteKit, Angular, NestJS, Hono, Astro, Remix, Nuxt, Symfony, and more.

**Detects package managers from lockfiles:** pnpm, yarn, npm, bun, uv, poetry, cargo, bundler, composer, go modules.

**What you get:**
- `CLAUDE.md` with your detected stack, commands, and essential sections
- `TASKS.md` for session continuity across Claude sessions
- `.claude/settings.json` with auto-format hooks and .env file protection (merges with existing)
- `.claudeignore` with language-specific ignore patterns (node_modules, __pycache__, dist, etc.)

### `enhance` — Let Claude finish what init started

Init auto-detects your stack but can't understand your architecture. Enhance spawns Claude interactively to read your actual codebase and fill in the gaps.

```bash
claude-launchpad enhance
```

Claude opens, reads your code, and updates CLAUDE.md with:
- **Architecture** — actual directory structure, data flow, key modules
- **Conventions** — patterns it observes in your code (naming, imports, state management)
- **Off-Limits** — guardrails based on what it sees (protected files, anti-patterns)
- **Key Decisions** — architectural decisions visible in the code

You see Claude working in real-time — same experience as running `claude` yourself.

### `eval` — Prove your config works

Runs Claude headless against 9 reproducible scenarios using the [Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) and **scores how well your config actually drives correct behavior**.

```bash
claude-launchpad eval --suite common
```

```
  ✓ security/sql-injection          10/10  PASS
  ✓ security/env-protection         10/10  PASS
  ✓ security/secret-exposure        10/10  PASS
  ✓ security/input-validation       10/10  PASS
  ✓ conventions/error-handling      10/10  PASS
  ✓ conventions/immutability        10/10  PASS
  ✓ conventions/no-hardcoded-values 10/10  PASS
  ✓ conventions/file-size           10/10  PASS
  ✗ workflow/git-conventions         7/10  WARN

  Config Eval Score      ━━━━━━━━━━━━━━━━━━──    89%
```

Each scenario is a YAML file. [Write your own](scenarios/CONTRIBUTING.md).

This is the part nobody else has built. Template repos scaffold. Audit tools diagnose. **Nobody tests whether your config actually makes Claude better.** Until now.

## How It Works Under the Hood

### doctor
Reads your `CLAUDE.md`, `.claude/settings.json`, `.claude/rules/`, and `.claudeignore`. Runs 7 analyzers that check instruction count, section completeness, hook configuration, rule validity, permission safety, and MCP server configs. Pure static analysis — no API calls, no network, no cost.

### init
Scans the project root for manifest files (`package.json`, `go.mod`, `pyproject.toml`, `Gemfile`, `Cargo.toml`, `composer.json`, etc.). Detects language, framework, package manager, and available scripts. Generates config files with stack-appropriate hooks (prettier for TypeScript, gofmt for Go, ruff for Python, etc.). Merges with existing `settings.json` if one exists.

### enhance
Spawns `claude "prompt"` as an interactive child process with `stdio: "inherit"` — you see Claude's full UI. The prompt instructs Claude to read the codebase and fill in CLAUDE.md sections. No data passes through the launchpad — it just launches Claude with a pre-loaded task.

### eval
1. Creates a temp directory (`/tmp/claude-eval-<uuid>/`)
2. Writes seed files from the scenario YAML (e.g., a `src/db.ts` with a TODO)
3. Writes a `CLAUDE.md` with the scenario's instructions
4. Initializes a git repo (Claude Code expects one)
5. Runs Claude via the [Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) with `allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"]` and `permissionMode: "dontAsk"` — or falls back to `claude -p` if the SDK isn't installed
6. After Claude finishes, runs grep/file assertions against the modified files
7. Scores: each check has points, total determines pass/fail
8. Cleans up the temp directory (or preserves it with `--debug`)

## Use in CI

Add this workflow to block PRs that degrade Claude Code config quality:

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

Exit code is 1 when score is below the threshold, 0 when it passes.

## Install as a Plugin

```bash
claude plugin install claude-launchpad
```

Then use `/launchpad:doctor`, `/launchpad:init`, `/launchpad:enhance`, and `/launchpad:eval` directly inside Claude Code. The plugin also nudges you to re-check your score when you edit config files.

## Why this exists

Claude Code configurations are the new `.eslintrc` — everyone has one, nobody knows if it's good. The difference:

- **CLAUDE.md is advisory** (~80% compliance). Claude might ignore your rules.
- **Hooks are deterministic** (100% compliance). But most people don't have any.
- **Instruction budget is real.** Past ~150 instructions, compliance drops. Most people don't know they're over.
- **Nobody measures.** You can't improve what you can't measure.

Claude Launchpad gives you a number. Fix the issues, re-run, watch the number go up.

## Philosophy

- **Zero dependencies on third-party Claude plugins.** Generates its own hooks and settings.
- **Doctor is free.** No API calls, no secrets, works offline and air-gapped.
- **Enhance uses Claude.** Spawns an interactive session to understand your codebase — costs tokens but produces a CLAUDE.md that actually knows your project.
- **Eval uses the Agent SDK.** Runs Claude headless in sandboxes with explicit tool permissions — proof that your config works.
- **Works with any stack.** Auto-detects your project. No fixed menu of supported frameworks.
- **50 tests.** The tool that tests configs is itself well-tested.
- **You never clone this repo.** It's a tool you run with `npx`, not a template you fork.

## License

MIT — Built by [McLovin](https://github.com/mboss37) (the AI behind [@mboss37](https://github.com/mboss37))
