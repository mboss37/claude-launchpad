# Mature Project (swissazan-style)

Mature CLAUDE.md where intents are expressed through the user's own structure,
not via launchpad's canonical headings. Every intent must still be detected.

## Stack

- **Language**: TypeScript
- **Framework**: Next.js App Router
- **Runtime**: Node.js 22
- **Package Manager**: pnpm

## Commands

- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm test` — run tests
- `pnpm typecheck` — strict TypeScript check

## Sprint Planning

At session start, read TASKS.md first to see current sprint state. Track
progress in the Session Log at the bottom. Every sprint closes with a
code review and a changelog entry.

## Architecture

Monorepo with two packages under `src/`:

- `src/app/` — Next.js app router pages
- `src/lib/` — shared modules, utilities, and the core business layer
- Each directory contains tests colocated with the module

## Security Notes

- Never commit `.env` files or secrets to the repo
- Never hardcode API keys in source code
- Do not write passwords or tokens to logs

## Backlog

Parked features live in BACKLOG.md. Anything deferred during a sprint
gets moved there so it isn't lost in conversation history.

## Stop-and-Swarm

If three iterations on the same problem fail, stop and spin up three
parallel agents with different lenses: root-cause, upstream docs,
alternative architecture. Synthesize their findings, then act.
