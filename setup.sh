#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ───
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ─── Helpers ───
print_banner() {
  echo ""
  echo -e "${CYAN}${BOLD}  Claude Launchpad${RESET}"
  echo -e "${DIM}  Interactive project scaffolder for Claude Code${RESET}"
  echo ""
}

print_success() { echo -e "  ${GREEN}✓${RESET} $1"; }
print_step() { echo -e "  ${CYAN}→${RESET} $1"; }
print_warn() { echo -e "  ${YELLOW}!${RESET} $1"; }
print_error() { echo -e "  ${RED}✗${RESET} $1"; }

prompt_yn() {
  local prompt="$1"
  while true; do
    echo -en "  ${BOLD}${prompt}${RESET} [y/n] " >&2
    read -r answer
    case "$answer" in
      [yY]|[yY][eE][sS]) echo "y"; return ;;
      [nN]|[nN][oO])     echo "n"; return ;;
      *) print_error "Please answer y or n." >&2 ;;
    esac
  done
}

prompt_text() {
  local prompt="$1"
  local result=""
  echo -en "  ${BOLD}${prompt}${RESET} " >&2
  read -r result
  echo "$result"
}

prompt_select() {
  local prompt="$1"
  shift
  local options=("$@")
  echo "" >&2
  echo -e "  ${BOLD}${prompt}${RESET}" >&2
  echo "" >&2
  for i in "${!options[@]}"; do
    echo -e "    ${CYAN}$((i+1)))${RESET} ${options[$i]}" >&2
  done
  echo "" >&2
  while true; do
    echo -en "  ${BOLD}Pick [1-${#options[@]}]:${RESET} " >&2
    read -r choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#options[@]}" ]; then
      echo "$choice"
      return
    fi
    print_error "Invalid choice. Try again." >&2
  done
}

# ─── Guard ───
if [ ! -f "CLAUDE.md" ] || ! grep -q '{{PROJECT_NAME}}' CLAUDE.md 2>/dev/null; then
  print_error "This doesn't look like an unconfigured Claude Launchpad template."
  print_error "Run this script from the root of a freshly cloned claude-launchpad repo."
  exit 1
fi

# ─── Main flow ───
print_banner

# Project name
project_name=$(prompt_text "Project name:")
if [ -z "$project_name" ]; then
  print_error "Project name cannot be empty."
  exit 1
fi

# Stack selection
stack_choice=$(prompt_select "Choose your stack:" \
  "Next.js + shadcn/ui + Supabase" \
  "Python + FastAPI + PostgreSQL" \
  "Go + HTMX + SQLite" \
  "Rails 8 + Hotwire + PostgreSQL" \
  "Custom (fill in manually)")

# Description
project_desc=$(prompt_text "One-line description (optional):")

echo ""
print_step "Generating project files..."

# ─── Generate CLAUDE.md ───
generate_claude_md() {
  local name="$1"
  local desc="$2"

  # Header (shared across all stacks)
  cat <<EOF
# ${name}

EOF

  if [ -n "$desc" ]; then
    echo "$desc"
    echo ""
  fi

  # ECC plugin note
  cat <<'STATIC'
<!--
  Install the ECC plugin for agents, skills, hooks, and rules:
  /plugin marketplace add affaan-m/everything-claude-code
  /plugin install everything-claude-code@everything-claude-code
  Then install rules:
  git clone https://github.com/affaan-m/everything-claude-code.git /tmp/ecc
  cd /tmp/ecc && npm install && ./install.sh <language>  (typescript | python | golang | swift)
-->

STATIC

  # Stack-specific content
  case "$3" in
    1) generate_stack_nextjs ;;
    2) generate_stack_fastapi ;;
    3) generate_stack_go ;;
    4) generate_stack_rails ;;
    5) generate_stack_custom ;;
  esac

  # Shared tail sections
  cat <<'STATIC'

## Session Start
- ALWAYS read @TASKS.md first — it tracks progress across sessions
- Check the Session Log at the bottom of TASKS.md for where we left off
- Update TASKS.md as you complete work (move tasks, append to session log)

## Workflow (ECC Skills)
- New feature: `/plan` first, then `/tdd` to implement
- After writing code: `/code-review` and `/security-scan` before committing
- Verification: `/verify` runs build + lint + tests in one command
- End of session: update TASKS.md with progress
- Extract patterns: `/learn-eval` to save reusable patterns from session

## Off-Limits
- Never hardcode secrets — use environment variables
- Never write to `.env` files
- Never expose internal error details in API responses
STATIC

  # Stack-specific off-limits
  case "$3" in
    1) cat <<'STATIC'
- Never bypass RLS — all client queries go through policies
- Never use service role key in client-side code
- Never edit files in `components/ui/` — use CLI to update
STATIC
    ;;
    2) cat <<'STATIC'
- Never use sync database calls — async everywhere
- Never skip Pydantic validation for request/response shapes
- Never store secrets in pyproject.toml
STATIC
    ;;
    3) cat <<'STATIC'
- No web frameworks — stdlib net/http only
- No CGo dependencies — pure Go only
- Never commit the binary (bin/ is gitignored)
STATIC
    ;;
    4) cat <<'STATIC'
- Never bypass Rails conventions without documenting why
- Never write raw SQL when ActiveRecord suffices
- Never skip system tests for critical user flows
STATIC
    ;;
  esac

  cat <<'STATIC'

## Key Decisions
<!-- Record architectural decisions as you make them -->
STATIC
}

generate_stack_nextjs() {
  cat <<'STATIC'
## Stack
- **Framework**: Next.js 15 (App Router, Server Components, Server Actions)
- **UI**: shadcn/ui + Tailwind CSS + Radix primitives
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Auth**: Supabase Auth (SSR helpers via `@supabase/ssr`)
- **Package Manager**: pnpm
- **Language**: TypeScript (strict mode)

## Architecture
- Full-stack monorepo — Next.js handles frontend + API
- Supabase for auth, database, storage, and realtime
- Server Components by default; Client Components only for interactivity
- RLS policies enforce authorization at the database layer

## Commands
- Dev server: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Type check: `pnpm tsc --noEmit`
- Supabase local: `pnpm supabase start`
- Generate types: `pnpm supabase gen types typescript --local > src/lib/database.types.ts`

## Project Structure
```
├── src/app/               # App Router pages and layouts
├── src/components/ui/     # shadcn/ui (DO NOT edit manually)
├── src/lib/supabase/      # Client helpers (browser, server, middleware)
├── supabase/migrations/   # SQL migrations
└── supabase/config.toml   # Local Supabase config
```

## Conventions
- Git: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Server Components by default; Client Components only for interactivity
- RLS policies enforce auth at DB layer, not application code
- Server Actions for mutations, validated with Zod
- shadcn components installed via CLI only
- Named exports, one component per file
- Use `@/` path alias for imports
STATIC
}

generate_stack_fastapi() {
  cat <<'STATIC'
## Stack
- **Framework**: FastAPI
- **Database**: PostgreSQL via SQLAlchemy 2.0 (async)
- **Auth**: JWT tokens with python-jose
- **Validation**: Pydantic v2 models
- **Package Manager**: uv
- **Language**: Python 3.12+ (strict type hints)

## Architecture
- API-first backend — FastAPI handles HTTP + validation
- PostgreSQL via async SQLAlchemy for persistence
- Repository pattern for data access layer
- Pydantic models at all boundaries (request/response/config)

## Commands
- Dev server: `uv run uvicorn app.main:app --reload`
- Test: `uv run pytest --cov`
- Lint: `uv run ruff check .`
- Format: `uv run ruff format .`
- Type check: `uv run mypy .`
- Migrate: `uv run alembic upgrade head`
- New migration: `uv run alembic revision --autogenerate -m "description"`

## Project Structure
```
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
```

## Conventions
- Git: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Async everywhere — async def for routes, async SQLAlchemy sessions
- Pydantic models for all request/response shapes
- Dependency injection via FastAPI Depends()
- Repository pattern for data access
- Type hints on every function signature
STATIC
}

generate_stack_go() {
  cat <<'STATIC'
## Stack
- **Language**: Go 1.23+
- **Router**: net/http (stdlib, no framework)
- **Frontend**: HTMX + Go templates
- **Database**: SQLite via modernc.org/sqlite (pure Go, no CGo)
- **Migrations**: goose

## Architecture
- Stdlib HTTP server — no web framework
- HTMX for dynamic UI without JavaScript frameworks
- SQLite for simple, embedded persistence
- embed.FS for production template bundling

## Commands
- Dev server: `go run ./cmd/server`
- Build: `go build -o bin/server ./cmd/server`
- Test: `go test ./...`
- Lint: `golangci-lint run`
- Migrate: `goose -dir migrations sqlite3 app.db up`

## Project Structure
```
├── cmd/server/            # Entrypoint (main.go)
├── internal/
│   ├── handler/           # HTTP handlers
│   ├── model/             # Domain types
│   ├── store/             # Database access (repository pattern)
│   └── tmpl/              # Go HTML templates
├── static/                # CSS, JS, images
├── migrations/            # SQL migrations (goose)
└── go.mod
```

## Conventions
- Git: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Stdlib net/http, no web framework
- Handlers return errors, middleware handles responses
- Templates use embed.FS for production builds
- Repository pattern for all DB access
- Table-driven tests
STATIC
}

generate_stack_rails() {
  cat <<'STATIC'
## Stack
- **Framework**: Ruby on Rails 8
- **Frontend**: Hotwire (Turbo + Stimulus) + Tailwind CSS
- **Database**: PostgreSQL
- **Auth**: Devise
- **Background Jobs**: Solid Queue
- **Package Manager**: Bundler + Importmap

## Architecture
- Rails monolith — convention over configuration
- Hotwire for SPA-like UX without JavaScript frameworks
- PostgreSQL for persistence, Solid Queue for background processing
- Turbo Frames for partial page updates, Turbo Streams for realtime

## Commands
- Dev server: `bin/dev`
- Console: `bin/rails console`
- Test: `bin/rails test`
- System test: `bin/rails test:system`
- Migrate: `bin/rails db:migrate`
- Generate: `bin/rails generate <type> <name>`

## Project Structure
```
├── app/
│   ├── controllers/       # Request handling
│   ├── models/            # ActiveRecord models
│   ├── views/             # ERB templates + Turbo Frames
│   ├── javascript/        # Stimulus controllers
│   └── jobs/              # Solid Queue jobs
├── config/                # Rails configuration
├── db/migrate/            # Database migrations
└── test/                  # Minitest files
```

## Conventions
- Git: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Convention over configuration — follow Rails defaults
- Turbo Frames for partial updates, Turbo Streams for realtime
- Stimulus for JS behavior, no custom JS unless necessary
- Fat models, skinny controllers
- System tests with Capybara for critical flows
STATIC
}

generate_stack_custom() {
  cat <<'STATIC'
## Stack
<!-- Define your tech stack: -->
<!-- - **Framework**: e.g. Next.js 15 / FastAPI / Go stdlib / Rails 8 -->
<!-- - **UI**: e.g. shadcn/ui + Tailwind / HTMX / Hotwire -->
<!-- - **Database**: e.g. Supabase / PostgreSQL / SQLite -->
<!-- - **Auth**: e.g. Supabase Auth / NextAuth / JWT / Devise -->
<!-- - **Package Manager**: e.g. pnpm / uv / go modules / bundler -->
<!-- - **Language**: e.g. TypeScript / Python / Go / Ruby -->

## Architecture
<!-- Describe your high-level architecture in 3-5 bullet points -->

## Commands
<!-- Fill in the commands for your project -->
<!-- - Dev server: `...` -->
<!-- - Build: `...` -->
<!-- - Test: `...` -->
<!-- - Lint: `...` -->
<!-- - Migrate: `...` -->

## Project Structure
```
├── src/                     # Source code
├── tests/                   # Tests
└── ...
```

## Conventions
- Git: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
<!-- Add your project-specific conventions -->
STATIC
}

# ─── Generate TASKS.md ───
generate_tasks_md() {
  local name="$1"
  local stack="$2"

  cat <<EOF
# ${name} — Task Tracker

> Claude: Read this at session start. Keep this file SHORT — only current state matters.
> Rules: (1) Only show current + next sprint tasks. (2) Completed sprints get one summary line. (3) Session log: max 3 lines per session, keep only last 3 sessions. (4) Target: under 80 lines total.

## Completed Sprints

## Current Sprint: Sprint 1 — Setup

### In Progress

### To Do
EOF

  case "$stack" in
    1) cat <<'STATIC'
- [ ] Set up Next.js project with pnpm
- [ ] Configure Supabase project (local + remote)
- [ ] Install shadcn/ui and base components
- [ ] Set up Supabase auth helpers
- [ ] Create initial DB schema + RLS policies
- [ ] Configure CI pipeline (lint, type check, build)
STATIC
    ;;
    2) cat <<'STATIC'
- [ ] Set up FastAPI project with uv
- [ ] Configure PostgreSQL + async SQLAlchemy
- [ ] Set up Alembic migrations
- [ ] Implement JWT auth flow
- [ ] Create base CRUD endpoints with Pydantic schemas
- [ ] Configure CI pipeline (lint, type check, test)
STATIC
    ;;
    3) cat <<'STATIC'
- [ ] Initialize Go module
- [ ] Create cmd/server entrypoint
- [ ] Configure SQLite + goose migrations
- [ ] Build base HTML templates with HTMX
- [ ] Set up handler/store/model packages
- [ ] Configure CI pipeline (lint, test, build)
STATIC
    ;;
    4) cat <<'STATIC'
- [ ] Generate Rails 8 app with PostgreSQL
- [ ] Configure Devise authentication
- [ ] Install Tailwind CSS + Hotwire
- [ ] Create initial models + migrations
- [ ] Set up Solid Queue for background jobs
- [ ] Configure CI pipeline (lint, test, system test)
STATIC
    ;;
    5) cat <<'STATIC'
- [ ] Project scaffolding
- [ ] Dev environment setup
- [ ] Configure auth
- [ ] Create initial database schema
- [ ] CI/CD pipeline
STATIC
    ;;
  esac

  cat <<'STATIC'

### Done

## Next Sprint: Sprint 2 — Core Features
- [ ] ...

## Session Log
<!-- Keep last 3 sessions only. Max 3 lines each. -->
STATIC
}

# ─── Generate .env.example ───
generate_env() {
  local stack="$1"

  case "$stack" in
    1) cat <<'STATIC'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
STATIC
    ;;
    2) cat <<'STATIC'
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/dbname

# Auth
SECRET_KEY=your-secret-key-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# App
APP_URL=http://localhost:8000
ENV=development
STATIC
    ;;
    3) cat <<'STATIC'
# Server
PORT=8080
ENV=development

# Database
DB_PATH=./app.db
STATIC
    ;;
    4) cat <<'STATIC'
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Rails
RAILS_MASTER_KEY=your-master-key
RAILS_ENV=development

# Redis (Action Cable / caching)
REDIS_URL=redis://localhost:6379/0
STATIC
    ;;
    5) cat <<'STATIC'
# TODO: Replace with your project's environment variables

# Database
# DATABASE_URL=...

# Auth
# SECRET_KEY=...

# App
# APP_URL=http://localhost:3000
# ENV=development
STATIC
    ;;
  esac
}

# ─── Write files ───
generate_claude_md "$project_name" "$project_desc" "$stack_choice" > CLAUDE.md
print_success "Generated CLAUDE.md"

generate_tasks_md "$project_name" "$stack_choice" > TASKS.md
print_success "Generated TASKS.md"

generate_env "$stack_choice" > .env.example
print_success "Generated .env.example"

# ─── Clean up template files ───
echo ""
print_step "Cleaning up template files..."

rm -f LICENSE
rm -f README.md
rm -rf docs/
rm -f setup.sh

print_success "Removed template files (setup.sh, README.md, LICENSE, docs/)"

# ─── Generate .claude/settings.json ───
mkdir -p .claude
cat > .claude/settings.json << 'SETTINGS'
{
  "enabledPlugins": {
    "everything-claude-code@everything-claude-code": true
  }
}
SETTINGS

print_success "Generated .claude/settings.json"

# ─── Reset git ───
print_step "Initializing fresh git repo..."

rm -rf .git
git init -q
git add -A
git commit -q -m "init: scaffold from claude-launchpad ($(date +%Y-%m-%d))"

print_success "Clean git history with initial commit"

# ─── ECC Plugin ───
echo ""
install_ecc_plugin() {
  if command -v claude &> /dev/null; then
    claude plugin marketplace add affaan-m/everything-claude-code 2>/dev/null && \
      claude plugin install everything-claude-code@everything-claude-code 2>/dev/null && \
      print_success "ECC plugin installed" || \
      print_warn "Could not install ECC plugin — run manually: claude plugin marketplace add affaan-m/everything-claude-code"
  else
    print_warn "Claude CLI not found — install the ECC plugin manually after installing Claude Code"
  fi
}

if command -v claude &> /dev/null && claude plugin list 2>/dev/null | grep -q "everything-claude-code"; then
  answer=$(prompt_yn "ECC plugin already installed. Reinstall to check for updates?")
  if [ "$answer" = "y" ]; then
    install_ecc_plugin
  else
    print_success "Keeping existing ECC plugin"
  fi
else
  print_step "Installing ECC plugin..."
  install_ecc_plugin
fi

# ─── Language Rules ───
echo ""
lang_choice=$(prompt_select "Install ECC language rules for this project?" \
  "TypeScript" \
  "Python" \
  "Go" \
  "Swift" \
  "Skip")

if [ "$lang_choice" -ne 5 ]; then
  case "$lang_choice" in
    1) lang="typescript" ;;
    2) lang="python" ;;
    3) lang="golang" ;;
    4) lang="swift" ;;
  esac

  print_step "Installing ${lang} rules..."
  rm -rf /tmp/ecc
  if git clone --quiet https://github.com/affaan-m/everything-claude-code.git /tmp/ecc 2>/dev/null; then
    (cd /tmp/ecc && npm install --silent 2>/dev/null && ./install.sh "$lang") && \
      print_success "Installed ${lang} rules" || \
      print_warn "Could not install rules — try manually: cd /tmp/ecc && npm install && ./install.sh ${lang}"
    rm -rf /tmp/ecc
  else
    print_warn "Could not clone ECC repo — check your network connection"
  fi
else
  print_success "Skipped language rules"
fi

# ─── Done ───
echo ""
echo -e "  ${GREEN}${BOLD}Done!${RESET} Your project is ready."
echo ""
echo -e "  ${BOLD}Next step:${RESET}"
echo -e "    claude"
echo ""

if [ "$stack_choice" -eq 5 ]; then
  echo -e "  ${YELLOW}${BOLD}Tip:${RESET} Tell Claude your stack and it'll fill in the rest:"
  echo -e "  ${DIM}\"Read CLAUDE.md and configure it for [your stack].\"${RESET}"
  echo ""
fi
