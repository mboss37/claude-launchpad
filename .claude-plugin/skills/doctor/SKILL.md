---
name: doctor
description: Diagnose your Claude Code configuration quality — instruction budget, CLAUDE.md quality, hooks, rules, permissions, MCP servers
command: /launchpad:doctor
userInvocable: true
---

# /doctor — Claude Code Config Diagnosis

Run a full diagnostic on the current project's Claude Code configuration.

## What to do

1. Run the diagnostic CLI:
```bash
npx claude-launchpad@latest doctor
```

2. Review the output — it shows:
   - **Instruction Budget**: Are you over the ~150 instruction limit?
   - **CLAUDE.md Quality**: Missing sections, vague instructions, hardcoded secrets
   - **Settings**: Plugin config, permission rules, environment variables
   - **Hooks**: Missing auto-format, no .env protection, no security gates
   - **Rules**: Dead rule files, stale references
   - **Permissions**: Dangerous tool access without security hooks
   - **MCP Servers**: Invalid configs, missing commands/URLs

3. Address issues by severity — critical and high first.

4. For JSON output (CI integration): `npx claude-launchpad@latest doctor --json`

5. For CI gating: `npx claude-launchpad@latest doctor --min-score 80`
