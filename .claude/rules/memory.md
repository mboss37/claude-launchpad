---
paths: ["src/commands/memory/**"]
---
# Memory Module Rules

- Native deps (better-sqlite3, sqlite-vec) are NEVER imported at top level -- use `cwdRequire()` from `utils/require-deps.ts`
- All MCP tool handlers go in `tools/` -- one file per tool, registered in `server.ts`
- Storage layer uses the repository pattern: `MemoryRepo`, `RelationRepo`, `SearchRepo` wrap raw SQLite
- Zod schemas for all MCP tool inputs live in `types.ts` -- never inline validation
- Dashboard is lazy-loaded via dynamic import -- `cli.ts` must never import Ink/React at startup
- Sync operations (push/pull) use pull-before-push to avoid data loss -- never skip the pull step
- Run `pnpm bench:memory` after ANY change in this directory -- no exceptions
- Content validation (`utils/content-validation.ts`) blocks secrets -- never bypass it
