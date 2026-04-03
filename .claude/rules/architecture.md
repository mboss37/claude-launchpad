# Architecture

## Project Structure
```
├── src/
│   ├── cli.ts                     # Entry point (registers init, doctor, eval, memory)
│   ├── commands/
│   │   ├── init/                  # Project scaffolder (auto-detects stack)
│   │   │   ├── index.ts           # Command + interactive prompts
│   │   │   └── generators/        # CLAUDE.md, TASKS.md, settings.json, skill generators
│   │   ├── doctor/                # Config diagnostic engine
│   │   │   ├── index.ts           # Command + report renderer
│   │   │   ├── analyzers/         # budget, settings, hooks, rules, permissions, mcp, memory
│   │   │   └── fixer.ts           # Auto-fix engine with FIX_TABLE
│   │   ├── eval/                  # Config testing engine
│   │   │   ├── index.ts           # Command + result renderer
│   │   │   ├── schema.ts          # YAML scenario validator
│   │   │   ├── loader.ts          # Scenario file loader
│   │   │   └── runner.ts          # Headless Claude execution (Agent SDK with CLI fallback)
│   │   └── memory/                # Optional persistent memory system
│   │       ├── index.ts           # Command factory (dynamic imports, no native deps at load)
│   │       ├── server.ts          # MCP server entry point (second tsup entry)
│   │       ├── config.ts          # Memory config + decay params
│   │       ├── types.ts           # Memory types + Zod schemas
│   │       ├── storage/           # SQLite repos (memory, relation, search, migrator)
│   │       ├── services/          # Retrieval, decay, consolidation, session
│   │       ├── tools/             # 7 MCP tool handlers
│   │       ├── subcommands/       # install, stats, context, extract, doctor
│   │       ├── dashboard/         # Blessed TUI (lazy-loaded via --dashboard)
│   │       └── utils/             # require-deps, git-context, content-validation
│   ├── lib/
│   │   ├── detect.ts              # Project auto-detection (language, framework, tools)
│   │   ├── parser.ts              # Parse .claude/ directory structure
│   │   ├── output.ts              # Terminal formatting (colors, tables, score bars)
│   │   └── settings.ts            # Shared readSettingsJson/writeSettingsJson
│   └── types/index.ts             # Core type definitions (doctor, eval, init)
├── scenarios/common/              # Built-in eval scenarios (YAML)
├── tests/                         # Vitest tests (262+)
└── tests/memory/                  # Memory-specific tests (storage, services, utils)
```

## Command Flow
- `init` → detect stack → prompt user → generate 7 files (incl. lp-enhance skill) → report score
- `doctor` → analyzers scan `.claude/` → score + report → optional `--fix` → memory analyzer conditional
- `/lp-enhance` → skill runs in Claude Code session → AI rewrites CLAUDE.md → suggests hooks + MCP
- `eval` → load YAML scenarios → run Claude via Agent SDK (fallback: CLI) → score checks → report
- `memory` → smart default: install prompt (if not set up) or stats (if installed)
- `memory --dashboard` → blessed TUI with vim nav, project switching, filtering
- `memory serve` → MCP server on stdio (called by Claude Code, not users)
- `memory context` → SessionStart hook handler (injects relevant memories)
- `memory extract` → Stop hook handler (extracts facts from transcript)

## Dependency Strategy
- **Core deps** (dependencies): commander, chalk, inquirer, ora, yaml — always installed
- **Optional deps** (optionalDependencies): zod, @modelcontextprotocol/sdk, blessed — installed with package, pure JS
- **Native deps** (devDependencies): better-sqlite3, sqlite-vec — NOT installed for users, user installs when setting up memory
- **Eval dep** (devDependencies): @anthropic-ai/claude-agent-sdk — eval falls back to Claude CLI if missing
- All optional/native deps marked `external` in tsup — never bundled into dist
- Memory commands use `cwdRequire()` for native deps (resolves from user's cwd node_modules)
- Memory command factory uses dynamic imports — `cli.ts` never loads native deps at startup

## Key Boundaries
- `src/lib/detect.ts` is the single source of truth for stack detection
- `src/types/index.ts` holds core type definitions — memory types are in `memory/types.ts`
- Analyzers in `doctor/analyzers/` are independent modules — each returns findings, none calls another
- Memory analyzer returns null when memory is not detected — no native deps in doctor
- Generators in `init/generators/` each produce one file — they share detected config but don't depend on each other
- `src/lib/settings.ts` is shared between doctor fixer and memory install (readSettingsJson/writeSettingsJson)
