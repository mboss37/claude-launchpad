---
name: eval
description: Test your Claude Code config against eval scenarios — runs Claude headless in sandboxes and scores the results
command: /launchpad:eval
userInvocable: true
---

# /eval — Test Config Effectiveness

Run Claude headless against reproducible scenarios and score how well your config drives correct behavior.

## What to do

1. Run the eval CLI:
```bash
npx claude-launchpad@latest eval --suite common
```

2. Options:
   - `--suite <name>` — Run a specific suite (e.g., `common`)
   - `--runs <n>` — Runs per scenario for statistical confidence (default: 3)
   - `--timeout <ms>` — Timeout per run (default: 120000)
   - `--debug` — Preserve sandbox directories for inspection
   - `--json` — JSON output for CI

3. Built-in scenarios test:
   - **security**: SQL injection, env protection, secret exposure, input validation
   - **conventions**: Error handling, immutability, file size, no hardcoded values
   - **workflow**: Git conventions

4. Each scenario creates an isolated sandbox, runs Claude with your config's instructions, and checks the output with grep/file assertions.

5. **Cost note**: Each scenario spawns a Claude session. 9 scenarios x 3 runs = 27 sessions. Estimate ~$1-3 depending on model.
