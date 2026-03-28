# Writing Eval Scenarios

Eval scenarios test whether Claude Code follows instructions when writing code. Each scenario creates an isolated sandbox, runs Claude with a prompt, and checks the output.

## YAML Format

```yaml
name: category/scenario-name         # Unique ID (e.g., security/sql-injection)
description: What this scenario tests
setup:
  files:                              # Seed files placed in the sandbox
    - path: src/example.ts
      content: |
        // Starter code with a TODO
  instructions: |                     # Written to CLAUDE.md in the sandbox
    Rules Claude should follow during this scenario.
prompt: "The task Claude is asked to do"
checks:                               # Assertions on Claude's output
  - type: grep
    pattern: "regex pattern"
    target: src/example.ts
    expect: present                   # or "absent"
    points: 5
    label: Human-readable check name
passingScore: 8                       # Minimum points to pass
runs: 3                               # Number of runs (median score used)
```

## Check Types

| Type | What it does | Pattern field |
|------|-------------|---------------|
| `grep` | Regex match on file content | Regex pattern |
| `file-exists` | Check if file was created | — |
| `file-absent` | Check file was NOT created | — |
| `max-lines` | No file in directory exceeds N lines | Max line count (e.g., "800") |

## Guidelines

1. **One behavior per scenario.** Don't test SQL injection AND error handling in the same scenario.
2. **Instructions should be specific.** "Always use parameterized queries" not "write secure code."
3. **Checks should be grep-able.** If you can't verify it with a regex, it's too subjective.
4. **Seed files should have TODOs.** Give Claude a clear starting point.
5. **3 runs minimum.** Claude is non-deterministic. Median score smooths variance.
6. **Points should reflect importance.** A security check is worth more than a style check.
7. **passingScore should be achievable.** Set it to ~80% of total points.

## Testing Your Scenario

```bash
# Run just your scenario
claude-launchpad eval --scenarios ./my-scenarios/ --runs 1 --debug

# The --debug flag preserves sandboxes so you can inspect what Claude wrote
```

## Submitting

Add your YAML file to `scenarios/common/` (stack-agnostic) and open a PR. Include:
- The scenario YAML
- Why this behavior matters
- Expected pass rate on a well-configured project
