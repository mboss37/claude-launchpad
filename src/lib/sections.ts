/**
 * Shared CLAUDE.md section content used by both init generators and doctor fixer.
 * Single source of truth — prevents drift between init and --fix.
 */

export const SESSION_START_CONTENT =
  "- ALWAYS read @TASKS.md first — it tracks progress across sessions\n" +
  "- Check the Session Log at the bottom of TASKS.md for where we left off\n" +
  "- Update TASKS.md as you complete work";

export const BACKLOG_CONTENT =
  "- When a feature is discussed but deferred, add it to BACKLOG.md immediately\n" +
  "- Never leave future ideas only in TASKS.md or conversation — they get lost\n" +
  "- BACKLOG.md is the single source of truth for parked features";

export const STOP_AND_SWARM_CONTENT =
  "Three failed iterations on the same problem = stop iterating alone.\n" +
  "On the fourth attempt, spin up at least 3 parallel agents via the Agent tool, each investigating from a different angle:\n" +
  "1. Root-cause debug agent\n" +
  "2. Upstream library/docs research agent\n" +
  "3. Alternative architecture agent\n" +
  "Wait for all agents to return, synthesize their findings, then act.\n" +
  "Don't keep guessing in circles — rotate perspectives.";

export const OFF_LIMITS_CONTENT =
  "- Never hardcode secrets — use environment variables\n" +
  "- Never write to `.env` files\n" +
  "- Never expose internal error details in API responses";

export const SKILL_AUTHORING_CONTENT =
  "When creating Claude Code skills (.claude/skills/*/SKILL.md):\n" +
  "\n" +
  "- Keep SKILL.md under 500 lines — move reference material to supporting files in the same directory\n" +
  "- Front-load description (first 250 chars shown in listings) with TRIGGER when / DO NOT TRIGGER when clauses\n" +
  "- Add allowed-tools in frontmatter to restrict tool access (e.g. Read, Glob, Grep for read-only skills)\n" +
  "- Add argument-hint in frontmatter showing the expected input format (use $ARGUMENTS or $0, $1 for dynamic input)\n" +
  "- Set disable-model-invocation: true for skills with side effects (deploy, send messages)\n" +
  "- Structure as phases: Research, Plan, Execute, Verify with \"Done when:\" success criteria per phase\n" +
  "- Handle edge cases and preconditions before execution";
