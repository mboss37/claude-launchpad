---
name: enhance
description: Let Claude analyze your codebase and complete CLAUDE.md with Architecture, Conventions, Off-Limits, and Key Decisions
command: /launchpad:enhance
userInvocable: true
---

# /enhance — Complete CLAUDE.md with Codebase Intelligence

Read CLAUDE.md and the project's codebase, then update CLAUDE.md to fill in missing or incomplete sections.

## CRITICAL: Budget Rule

CLAUDE.md must stay UNDER 120 lines of actionable content. Claude Code starts ignoring rules past ~150 instructions. If you need more detail, create `.claude/rules/` files:
- `.claude/rules/conventions.md` for detailed coding patterns
- `.claude/rules/architecture.md` for detailed structure docs
- Keep CLAUDE.md to HIGH-LEVEL summaries only (3-5 bullets per section max)

## Sections to Fill

1. **## Architecture** — 3-5 bullet points describing the codebase shape (not a full directory tree)
2. **## Conventions** — max 8 key patterns. Move detailed rules to `.claude/rules/conventions.md`
3. **## Off-Limits** — max 8 guardrails specific to this project
4. **## Key Decisions** — only decisions that affect how Claude should work in this codebase

## Rules
- Don't remove existing content — only add or improve
- Be specific to THIS project, not generic advice
- Use bullet points, not paragraphs
- If a section would exceed 8 bullets, split into a `.claude/rules/` file and reference it
- After editing, count the actionable lines. If over 120, move content to rules files
- Suggest running `claude-launchpad doctor` after to verify the score improved
