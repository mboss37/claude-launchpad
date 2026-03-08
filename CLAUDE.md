# {{PROJECT_NAME}}

<!-- TODO: Replace {{PROJECT_NAME}} with your project name and write a one-line description -->

## Stack
- **Framework**: Next.js 15 (App Router, Server Components, Server Actions)
- **UI**: shadcn/ui + Tailwind CSS + Radix primitives
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Auth**: Supabase Auth (SSR helpers via `@supabase/ssr`)
- **ORM**: Supabase client (no separate ORM — use typed queries via `supabase-js`)
- **Package Manager**: pnpm
- **Language**: TypeScript (strict mode)

## Session Start
- ALWAYS read @TASKS.md first — it tracks progress across sessions
- Check the Session Log at the bottom of TASKS.md for where we left off
- Update TASKS.md as you complete work (move tasks, append to session log)

## Architecture
- Full-stack monorepo — Next.js handles both frontend and API (Route Handlers + Server Actions)
- Supabase for auth, database, storage, and realtime — no custom backend needed
- Server Components by default; Client Components only when interactivity requires it
- RLS policies enforce authorization at the database layer, not in application code
- Edge-compatible where possible (middleware, API routes)

## Commands
- Dev server: `pnpm dev`
- Build: `pnpm build`
- Lint: `pnpm lint`
- Format: `pnpm format`
- Test: `pnpm test`
- Type check: `pnpm tsc --noEmit`
- Supabase local: `pnpm supabase start`
- Supabase migrations: `pnpm supabase db push`
- Generate types: `pnpm supabase gen types typescript --local > src/lib/database.types.ts`

## Project Structure
```
├── src/
│   ├── app/                    # Next.js App Router pages and layouts
│   │   ├── (auth)/             # Auth route group (login, signup, callback)
│   │   ├── (dashboard)/        # Protected route group
│   │   ├── api/                # Route Handlers
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Landing page
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components (DO NOT edit manually)
│   │   └── ...                 # App-specific components
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts       # Browser client
│   │   │   ├── server.ts       # Server client (cookies-based)
│   │   │   └── middleware.ts   # Middleware client (for auth refresh)
│   │   ├── database.types.ts   # Generated Supabase types
│   │   └── utils.ts            # Shared utilities (cn, etc.)
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # App-wide TypeScript types
├── supabase/
│   ├── migrations/             # SQL migrations (sequential, never edit old ones)
│   ├── seed.sql                # Development seed data
│   └── config.toml             # Supabase local config
├── public/                     # Static assets
├── tests/                      # Test files
└── ...
```

## Conventions
- Git: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- TypeScript: Strict mode, no `any` types, prefer `unknown` for untyped data
- Components: Named exports, one component per file, colocate styles/tests
- shadcn/ui: Install via `pnpm dlx shadcn@latest add <component>` — never edit `components/ui/` directly
- Supabase queries: Always use generated types from `database.types.ts`
- API responses: Use Next.js conventions (`NextResponse.json()`) with consistent `{ data, error }` shape
- Database: UUIDs for PKs, `snake_case` columns, `created_at`/`updated_at` timestamps on every table
- RLS: Every table must have RLS enabled with explicit policies before use
- Server Actions: Prefer over Route Handlers for mutations; validate with Zod
- Imports: Use `@/` path alias for `src/`

## Off-Limits
- Never hardcode secrets — use environment variables
- Never write to `.env` files
- Never expose internal error details in API responses
- Never bypass RLS — all client queries go through policies
- Never use `supabaseAdmin` (service role) in client-side code
- Never edit files in `components/ui/` — use shadcn CLI to update
- Never store auth tokens manually — `@supabase/ssr` handles cookies

## Workflow (ECC Skills)
- New feature: `/plan` first, then `/tdd` to implement
- After writing code: `/security-scan` before committing
- End of session: update TASKS.md with progress
- Debugging: use the debugger agent for systematic diagnosis
- Code review: use the code-reviewer agent after implementation
- Extract patterns: `/learn-eval` to save reusable patterns from session

## Key Decisions
<!-- TODO: Record architectural decisions as you make them -->
<!-- Example: -->
<!-- - Chose pnpm over npm: faster installs, strict dependency resolution -->
<!-- - Supabase over custom auth: managed infra, built-in RLS, realtime -->
