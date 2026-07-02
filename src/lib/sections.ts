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
  "- BACKLOG.md is the single source of truth for parked features\n" +
  "- Every WP uses the 7-field template in BACKLOG.md — no freeform entries\n" +
  "- Pull a WP into a sprint = **move**, not copy. A WP lives in exactly one file at a time";

export const STOP_AND_SWARM_CONTENT =
  "Three failed iterations on the same problem = stop iterating alone.\n" +
  "(An iteration = an attempted fix that did not change the failing symptom. Announce \"Attempt N\" when retrying so the count stays visible.)\n" +
  "First, one systematic pass — it usually resolves the loop without the swarm:\n" +
  "reproduce the failure, read the FULL error output, state one hypothesis about the root cause, and verify it BEFORE writing any fix.\n" +
  "Only if that pass fails, swarm: dispatch at least 3 parallel subagents via the Task tool — in a single message so they run concurrently — each investigating from a different angle:\n" +
  "1. Root-cause debug agent\n" +
  "2. Upstream library/docs research agent\n" +
  "3. Alternative architecture agent\n" +
  "Hand each agent the exact repro command, the full error text, and the list of already-failed fixes — subagents start with empty context.\n" +
  "Wait for all agents to return, synthesize their findings, then act.\n" +
  "For re-planning after repeated failure, switch to plan mode instead of attempting again.";

/** The exact phrase shipped by pre-v1.12 templates — doctor flags and rewrites it. */
export const STALE_SWARM_PHRASE = "spin up at least 3 parallel agents via the Agent tool";
export const SWARM_PHRASE_REPLACEMENT = "dispatch at least 3 parallel subagents via the Task tool (in a single message so they run concurrently)";

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

/**
 * Sprint review checklist: delegate to native /code-review + /security-review,
 * anchored to the sprint's base commit, with the manual pass as fallback.
 * Verification commands are interpolated from stack detection when known.
 */
export function sprintReviewsContent(testCommand: string | null, lintCommand: string | null, superpowers = false): string {
  const known = [testCommand, lintCommand].filter((c): c is string => !!c).map((c) => `\`${c}\``).join(" and ");
  const verifyLine = known
    ? `- Run ${known} — must pass before the sprint-ending commit`
    : "- Run the project's test and typecheck commands — they must pass before the sprint-ending commit";
  return (
    "When all tasks in the current sprint are complete, review before the closing commit:\n" +
    "- Find the sprint base: \`git log --grep 'chore(sprint-' -n 1 --format=%H\`\n" +
    "- Run /code-review on the diff from that base; fix all Critical and Important findings before committing\n" +
    "- Run /security-review if the sprint touched auth, input handling, or dependencies\n" +
    verifyLine + "\n" +
    "- If /code-review is unavailable, do a manual pass: dead code, debug logs, TODO hacks, convention violations, hardcoded values\n" +
    (superpowers
      ? "- superpowers detected: invoke superpowers:requesting-code-review for the independent pass (severity-gated)\n"
      : "- For an independent second pass, dispatch the code-reviewer agent (.claude/agents/code-reviewer.md) with the base/head SHAs\n") +
    "- Skip only if the sprint was trivial (docs or config-only changes)"
  );
}

export const TESTING_DISCIPLINE_CONTENT =
  "Hard-TDD surfaces — write the failing test BEFORE any implementation for:\n" +
  "- A new module, command, or public API\n" +
  "- Any bug fix (regression test from the minimal repro first)\n" +
  "- Any algorithm or scoring change\n" +
  "Flexible (tests land in the same commit, order free): docs, config, version bumps, log messages.\n" +
  "If unsure which bucket a change falls into, default to test-first.";
