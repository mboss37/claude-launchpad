# Architecture

## Project Structure
```
├── src/
│   ├── cli.ts                     # Entry point
│   ├── commands/
│   │   ├── init/                  # Project scaffolder (auto-detects stack)
│   │   │   ├── index.ts           # Command + interactive prompts
│   │   │   └── generators/        # CLAUDE.md, TASKS.md, settings.json, skill generators
│   │   ├── doctor/                # Config diagnostic engine
│   │   │   ├── index.ts           # Command + report renderer
│   │   │   └── analyzers/         # budget, settings, hooks, rules, permissions, mcp
│   │   └── eval/                  # Config testing engine
│   │       ├── index.ts           # Command + result renderer
│   │       ├── schema.ts          # YAML scenario validator
│   │       ├── loader.ts          # Scenario file loader
│   │       └── runner.ts          # Headless Claude execution + check evaluation
│   ├── lib/
│   │   ├── detect.ts              # Project auto-detection (language, framework, tools)
│   │   ├── parser.ts              # Parse .claude/ directory structure
│   │   └── output.ts              # Terminal formatting (colors, tables, score bars)
│   └── types/index.ts             # All type definitions
├── scenarios/common/              # Built-in eval scenarios (YAML)
├── tests/                         # Vitest tests
└── setup.sh                       # Legacy bash scaffolder (to be removed)
```

## Command Flow
- `doctor` → analyzers scan `.claude/` → score + report → optional `--fix`
- `init` → detect stack → prompt user → generate 7 files (incl. lp-enhance skill) → report score
- `/lp-enhance` → skill runs in Claude Code session → AI rewrites CLAUDE.md → suggests hooks + MCP
- `eval` → load YAML scenarios → run Claude via Agent SDK → score checks → report

## Key Boundaries
- `src/lib/detect.ts` is the single source of truth for stack detection (language, framework, package manager, tools)
- `src/types/index.ts` holds all shared type definitions — no inline type declarations in command files
- Analyzers in `doctor/analyzers/` are independent modules — each returns findings, none calls another
- Generators in `init/generators/` each produce one file — they share detected config but don't depend on each other
