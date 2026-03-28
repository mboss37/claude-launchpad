---
name: enhance
description: Let Claude analyze your codebase and complete CLAUDE.md with Architecture, Conventions, Off-Limits, and Key Decisions
command: /launchpad:enhance
userInvocable: true
---

# /enhance — Complete CLAUDE.md with Codebase Intelligence

Read CLAUDE.md and the project's codebase, then update CLAUDE.md to fill in missing or incomplete sections:

1. **## Architecture** or **## Project Structure** — describe the actual codebase structure (directories, key files, data flow)
2. **## Conventions** — add project-specific patterns you observe (naming, imports, state management, API patterns)
3. **## Off-Limits** — add guardrails based on what you see (protected files, patterns to avoid, things that should never change)
4. **## Key Decisions** — document any architectural decisions visible in the code

## Rules
- Keep CLAUDE.md under 150 instructions (lines of actionable content)
- Don't remove existing content — only add or improve
- Be specific to THIS project, not generic advice
- Use bullet points, not paragraphs
- After completing, suggest running `claude-launchpad doctor` to verify the score improved
