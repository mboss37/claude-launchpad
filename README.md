# Claude Launchpad

**Your Claude Code setup is probably broken. This tool tells you how.**

Claude Code's effectiveness is 90% configuration, 10% prompting. But nobody can tell if their config is actually good. You write a `CLAUDE.md`, add some hooks, install some plugins — and then *hope* Claude follows them.

Claude Launchpad is the first CLI that **diagnoses, scaffolds, enhances, and tests** Claude Code configurations. Think ESLint for your AI setup.

```bash
npx claude-launchpad
```

## The Workflow

```bash
npx claude-launchpad init        # 1. Auto-detect stack, generate config + hooks
npx claude-launchpad enhance     # 2. Claude reads your code, completes CLAUDE.md
npx claude-launchpad             # 3. Check your score (42%)
npx claude-launchpad doctor --fix  # 4. Auto-fix everything (→ 86%)
npx claude-launchpad             # 5. Confirm the jump
```

> See the [full story on the landing page](https://mboss37.github.io/claude-launchpad/) — a 42% → 86% journey in three commands.

## Commands

### `doctor` — Know your score

Runs 7 static analyzers against your `.claude/` directory and `CLAUDE.md`. No API calls, no cost, works offline.

```
  Instruction Budget     ━━━━━━━━━━━━━━━━━━━━   100%
  CLAUDE.md Quality      ━━━━━━━━━━━━━━━━━━━━   100%
  Settings               ━━━━━━━━━━━━━━━━━───    85%
  Hooks                  ━━━━━━━━━━━━━━━━━━━━   100%
  Rules                  ━━━━━━━━━━━━────────    60%
  Permissions            ━━━━━━━━━━━━━━━━────    80%
  MCP Servers            ━━━━━━━━━━──────────    50%

  Overall                ━━━━━━━━━━━━━━━━────    82%

   MEDIUM  Hooks
    No .env file protection hook
    Fix: Add a PreToolUse hook that blocks writes to .env files

   LOW  Permissions
    No force-push protection hook
    Fix: Add a PreToolUse hook that warns on `git push --force` commands
```

Running bare `claude-launchpad` with no subcommand auto-detects your config and runs doctor.

**Watch mode:** `claude-launchpad doctor --watch` — live score that updates every time you save a config file.

**What it checks:**

| Analyzer | What it catches |
|---|---|
| **Instruction Budget** | Are you over the ~150 instruction limit where Claude starts ignoring rules? |
| **CLAUDE.md Quality** | Missing essential sections, vague instructions ("write good code"), hardcoded secrets |
| **Settings** | Plugin config, permission rules, environment variables |
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
```

**Detects 13 languages:** TypeScript, JavaScript, Python, Go, Ruby, Rust, Dart, PHP, Java, Kotlin, Swift, Elixir, C#

**Detects 20+ frameworks:** Next.js, FastAPI, Django, Rails, Laravel, Express, SvelteKit, Angular, NestJS, Hono, Astro, Remix, Nuxt, Symfony, and more.

**Detects package managers from lockfiles:** pnpm, yarn, npm, bun, uv, poetry, cargo, bundler, composer, go modules.

**What you get:**
- `CLAUDE.md` with your detected stack, commands, and essential sections
- `TASKS.md` for session continuity across Claude sessions
- `.claude/settings.json` with auto-format hooks and .env file protection

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

### `eval` — Test your config (coming soon)

Runs Claude headless against reproducible scenarios and **scores how well your config actually works**.

```bash
claude-launchpad eval --suite security
```

```
  ✓ security/sql-injection          10/10  PASS
  ✓ security/env-file-protection    10/10  PASS
  ✗ conventions/error-handling       7/10  WARN
  ✗ conventions/file-size            4/10  FAIL

  Config Eval Score        ━━━━━━━━━━━━━━━━────    78%
```

This is the part nobody else has built. Template repos scaffold. Audit tools diagnose. **Nobody tests whether your config actually makes Claude better.** Until now.

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

Exit code is 1 when score is below the threshold, 0 when it passes. The workflow only triggers when Claude Code config files change.

## Install as a Plugin

```bash
claude plugin install claude-launchpad
```

Then use `/doctor` and `/init` directly inside Claude Code.

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
- **Eval costs money.** Runs Claude headless against scenarios — proof that your config works.
- **Works with any stack.** Auto-detects your project. No fixed menu of supported frameworks.
- **You never clone this repo.** It's a tool you run with `npx`, not a template you fork.

## License

MIT
