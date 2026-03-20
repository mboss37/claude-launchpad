# Claude Launchpad

An interactive scaffolder for Claude Code projects. Run `./setup.sh`, pick your stack, and get a fully configured `CLAUDE.md`, task tracker, and environment template — ready for [Everything Claude Code (ECC)](https://github.com/affaan-m/everything-claude-code).

---

## Quick Start

```bash
git clone https://github.com/mboss37/claude-launchpad.git my-project
cd my-project
./setup.sh
```

The setup script will:
1. Ask for your project name and stack
2. Generate a fully filled-in `CLAUDE.md` (architecture, commands, conventions, guardrails)
3. Generate `TASKS.md` with stack-specific Sprint 1 tasks
4. Generate `.env.example` with stack-specific environment variables
5. Clean up template files and reset git history
6. Install / update the [ECC plugin](https://github.com/affaan-m/everything-claude-code) (global, auto-detects if already installed)
7. Install language-specific ECC rules for your project

### Supported stacks

| Option | Stack | What gets generated |
|--------|-------|-------------------|
| 1 | Next.js + shadcn/ui + Supabase | App Router, RSC, RLS, Supabase Auth, pnpm |
| 2 | Python + FastAPI + PostgreSQL | async SQLAlchemy, Alembic, uv, Pydantic |
| 3 | Go + HTMX + SQLite | stdlib net/http, goose, embed.FS |
| 4 | Rails 8 + Hotwire + PostgreSQL | Turbo, Stimulus, Solid Queue, Devise |
| 5 | Custom | Guided skeleton with TODOs — tell Claude your stack |

---

## What's Generated

After running `./setup.sh`, your project contains:

```
my-project/
├── CLAUDE.md              # Fully configured for your stack
├── TASKS.md               # Stack-specific Sprint 1 tasks
├── .env.example           # Stack-specific env vars
├── .gitignore             # Sensible defaults
└── .claude/
    └── settings.json      # ECC plugin enabled
```

### CLAUDE.md — Project Memory

Loaded into Claude's context every session. Contains your stack, architecture, commands, project structure, conventions, and guardrails — all filled in for your chosen stack, not TODOs.

### TASKS.md — Sprint Tracker

Persists across sessions. Claude reads it at session start to know what was done, what's in progress, and what's next. Pre-populated with stack-appropriate setup tasks.

---

## ECC Plugin — What It Provides

| Category | Count | Highlights |
|---|---|---|
| **Agents** | 16 | planner, architect, tdd-guide, code-reviewer, security-reviewer, build-error-resolver |
| **Skills** | 65+ | `/plan`, `/tdd`, `/security-scan`, `/learn-eval`, `/e2e`, `/deploy` |
| **Commands** | 40+ | Slash commands for every workflow |
| **Hooks** | 20 | Auto-format, type check, security gates, session persistence |
| **Rules** | Per-language | TypeScript, Python, Go, Swift + 9 common rules |

See the [ECC repo](https://github.com/affaan-m/everything-claude-code) and [longform guide](https://github.com/affaan-m/everything-claude-code/blob/main/the-longform-guide.md) for full documentation.

---

## Credits

- [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) by [Affaan Mustafa](https://x.com/affaanmustafa) — the agent toolkit powering this scaffolder.

## License

MIT
