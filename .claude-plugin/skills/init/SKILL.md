---
name: init
description: Set up optimized Claude Code configuration for any project — auto-detects stack, generates CLAUDE.md, TASKS.md, and hooks
command: /launchpad:init
userInvocable: true
---

# /init — Claude Code Config Scaffolding

Auto-detect the current project and generate optimized Claude Code configuration.

## What to do

1. Run the scaffolder:
```bash
npx claude-launchpad@latest init
```

2. It auto-detects:
   - Language (TypeScript, Python, Go, Ruby, Rust, PHP, Java, Kotlin, Swift, Elixir, C#, Dart)
   - Framework (Next.js, FastAPI, Django, Rails, Laravel, Express, and 15+ more)
   - Package manager (pnpm, yarn, npm, uv, poetry, cargo, bundler, composer)
   - Dev/build/test/lint/format commands from package.json scripts or language conventions

3. It generates:
   - `CLAUDE.md` with detected stack, commands, essential sections, and guardrails
   - `TASKS.md` for session continuity across Claude Code sessions
   - `.claude/settings.json` with auto-format hooks and .env file protection

4. After init, run `/doctor` to verify the generated config quality.

## Flags

- `--name <name>` — Set project name (auto-detected from directory name)
- `--yes` — Accept all defaults without prompting
