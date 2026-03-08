# Claude Code Bootstrap Template

A minimal project template for starting new Claude Code projects with the right structure from day one. Pairs with [Everything Claude Code (ECC)](https://github.com/affaan-m/everything-claude-code) for a production-grade agent toolkit — 16 agents, 65 skills, 40+ commands, and hooks out of the box.

This template provides the **project-specific layer** (memory, tasks, conventions) while ECC provides the **tooling layer** (agents, skills, hooks, rules).

---

## Quick Start

```bash
# 1. Clone the template
git clone https://github.com/mboss37/claude-bootstrap-template.git my-project
cd my-project

# 2. Reset git history
rm -rf .git && git init

# 3. Install the ECC plugin (agents, skills, hooks, commands)
claude
# Then inside Claude Code:
/plugin marketplace add affaan-m/everything-claude-code
/plugin install everything-claude-code@everything-claude-code

# 4. Install language-specific rules
git clone https://github.com/affaan-m/everything-claude-code.git /tmp/ecc
cd /tmp/ecc && ./install.sh typescript   # or: python, golang, swift

# 5. Restart Claude Code, then tell it your stack
claude
```

Then tell Claude:

> "Read CLAUDE.md and adapt it for my project. I'm building [describe your project] with [your stack]."

---

## What's Inside

```
├── CLAUDE.md                  # Project memory — loaded every session
├── TASKS.md                   # Sprint tracker — read at session start
├── .env.example               # Required environment variables
├── .gitignore                 # Sensible defaults for web projects
├── LICENSE                    # MIT
└── docs/
    └── index.html             # GitHub Pages site
```

That's it. The template is intentionally minimal — ECC handles the heavy lifting (agents, skills, hooks, rules). These files are what ECC *doesn't* provide: your project-specific memory and task tracking.

### CLAUDE.md — Project Memory

The single most important file. Loaded into Claude's context every session. Contains your stack, architecture, commands, project structure, conventions, and guardrails. The template ships with a Next.js + shadcn + Supabase configuration as a default — adapt it to your stack.

### TASKS.md — Sprint Tracker

Lightweight task tracker that persists across sessions. Claude reads it at session start to know what was done, what's in progress, and what's next. Keeps itself short: completed sprints collapse to one line, session log keeps only the last 3 entries.

---

## Adapting to Any Stack

The default `CLAUDE.md` is configured for **Next.js + shadcn/ui + Supabase**, but this template works with any stack. Here's how to adapt it:

### Option 1: Tell Claude (recommended)

Just describe your stack and Claude rewrites everything:

> "I'm building a Go API with HTMX frontend and SQLite. Update CLAUDE.md for this stack."

> "This is a Python FastAPI project with PostgreSQL and SQLAlchemy. Reconfigure everything."

> "Change the stack to a Rails 8 monolith with Hotwire and PostgreSQL."

### Option 2: Edit CLAUDE.md manually

Replace each section to match your stack. Here are examples for common setups:

#### Next.js + shadcn + Supabase (default)

```markdown
## Stack
- **Framework**: Next.js 15 (App Router, Server Components, Server Actions)
- **UI**: shadcn/ui + Tailwind CSS + Radix primitives
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Auth**: Supabase Auth (SSR helpers via `@supabase/ssr`)
- **Package Manager**: pnpm
- **Language**: TypeScript (strict mode)

## Commands
- Dev server: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Supabase local: `pnpm supabase start`
- Generate types: `pnpm supabase gen types typescript --local > src/lib/database.types.ts`

## Project Structure
├── src/app/               # App Router pages and layouts
├── src/components/ui/     # shadcn/ui (DO NOT edit manually)
├── src/lib/supabase/      # Client helpers (browser, server, middleware)
├── supabase/migrations/   # SQL migrations
└── supabase/config.toml   # Local Supabase config

## Conventions
- Server Components by default; Client Components only for interactivity
- RLS policies enforce auth at DB layer, not application code
- Server Actions for mutations, validated with Zod
- shadcn components installed via CLI only
```

#### Python + FastAPI + PostgreSQL

```markdown
## Stack
- **Framework**: FastAPI
- **Database**: PostgreSQL via SQLAlchemy 2.0 (async)
- **Auth**: JWT tokens with python-jose
- **Validation**: Pydantic v2 models
- **Package Manager**: uv
- **Language**: Python 3.12+ (strict type hints)

## Commands
- Dev server: `uv run uvicorn app.main:app --reload`
- Test: `uv run pytest --cov`
- Lint: `uv run ruff check .`
- Format: `uv run ruff format .`
- Migrate: `uv run alembic upgrade head`
- New migration: `uv run alembic revision --autogenerate -m "description"`

## Project Structure
├── app/
│   ├── api/routes/        # Endpoint routers
│   ├── models/            # SQLAlchemy models
│   ├── schemas/           # Pydantic request/response schemas
│   ├── services/          # Business logic
│   ├── core/config.py     # Settings via pydantic-settings
│   └── main.py            # FastAPI app factory
├── alembic/               # Database migrations
├── tests/                 # Pytest test files
└── pyproject.toml

## Conventions
- Async everywhere — async def for routes, async SQLAlchemy sessions
- Pydantic models for all request/response shapes
- Dependency injection via FastAPI Depends()
- Repository pattern for data access
- Type hints on every function signature
```

#### Go + HTMX + SQLite

```markdown
## Stack
- **Language**: Go 1.23+
- **Router**: net/http (stdlib, no framework)
- **Frontend**: HTMX + Go templates
- **Database**: SQLite via modernc.org/sqlite (pure Go, no CGo)
- **Migrations**: goose

## Commands
- Dev server: `go run ./cmd/server`
- Build: `go build -o bin/server ./cmd/server`
- Test: `go test ./...`
- Lint: `golangci-lint run`
- Migrate: `goose -dir migrations sqlite3 app.db up`

## Project Structure
├── cmd/server/            # Entrypoint (main.go)
├── internal/
│   ├── handler/           # HTTP handlers
│   ├── model/             # Domain types
│   ├── store/             # Database access (repository pattern)
│   └── tmpl/              # Go HTML templates
├── static/                # CSS, JS, images
├── migrations/            # SQL migrations (goose)
└── go.mod

## Conventions
- Stdlib net/http, no web framework
- Handlers return errors, middleware handles responses
- Templates use embed.FS for production builds
- Repository pattern for all DB access
- Table-driven tests
```

#### Rails 8 + Hotwire

```markdown
## Stack
- **Framework**: Ruby on Rails 8
- **Frontend**: Hotwire (Turbo + Stimulus) + Tailwind CSS
- **Database**: PostgreSQL
- **Auth**: Devise
- **Background Jobs**: Solid Queue
- **Package Manager**: Bundler + Importmap

## Commands
- Dev server: `bin/dev`
- Console: `bin/rails console`
- Test: `bin/rails test`
- Migrate: `bin/rails db:migrate`
- Generate: `bin/rails generate <type> <name>`

## Conventions
- Convention over configuration — follow Rails defaults
- Turbo Frames for partial updates, Turbo Streams for realtime
- Stimulus for JS behavior, no custom JS unless necessary
- Fat models, skinny controllers
- System tests with Capybara for critical flows
```

### Don't forget the rules

After updating `CLAUDE.md`, install the matching ECC rules:

```bash
# Install rules for your language (picks up common + language-specific)
cd /tmp/ecc && ./install.sh typescript   # Next.js, React, Node.js
cd /tmp/ecc && ./install.sh python       # FastAPI, Django, Flask
cd /tmp/ecc && ./install.sh golang       # Go projects
cd /tmp/ecc && ./install.sh swift        # iOS/macOS projects

# Multiple languages at once
cd /tmp/ecc && ./install.sh typescript python
```

---

## ECC Plugin — What It Provides

Once installed, ECC gives you:

| Category | Count | Examples |
|---|---|---|
| **Agents** | 16 | planner, architect, tdd-guide, code-reviewer, security-reviewer, build-error-resolver |
| **Skills** | 65+ | `/plan`, `/tdd`, `/security-scan`, `/learn-eval`, `/e2e`, `/deploy` |
| **Commands** | 40+ | Slash commands for common workflows |
| **Rules** | Per-language | TypeScript, Python, Go, Swift + common rules |

Key skills you'll use most:

```bash
/plan          # Create implementation plan before coding
/tdd           # Test-driven development workflow
/security-scan # Scan for vulnerabilities
/learn-eval    # Extract reusable patterns from session
/e2e           # Generate and run E2E tests
```

See the [ECC repo](https://github.com/affaan-m/everything-claude-code) and [longform guide](https://github.com/affaan-m/everything-claude-code/blob/main/the-longform-guide.md) for full documentation.

---

## Credits

- [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) by [Affaan Mustafa](https://x.com/affaanmustafa) — the agent toolkit powering this template. 16 agents, 65 skills, 40+ commands, and the most comprehensive Claude Code plugin available. Read the [longform guide](https://github.com/affaan-m/everything-claude-code/blob/main/the-longform-guide.md) for advanced patterns on token optimization, memory persistence, parallelization, and subagent orchestration.

## License

MIT — use this template however you like.
