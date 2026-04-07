---
paths: ["src/commands/doctor/**"]
---
# Doctor Module Rules

- Doctor is pure static analysis -- ZERO API calls, ZERO cost, works fully offline
- Each analyzer in `analyzers/` is independent -- returns findings, never calls another analyzer
- Memory analyzer returns null when memory is not detected -- no native deps in doctor path
- The fixer (`fixer.ts`, `fixer-memory.ts`) uses a FIX_TABLE lookup -- add new fixes there, not as switch cases
- `--fix` must re-scan after applying fixes to verify the fix actually worked
- Doctor is the free gateway -- never add features that require API keys or paid services
- Findings use severity levels: error > warning > info -- map to score deductions accordingly
- When adding a new check, add a corresponding fixer entry if the fix is automatable
