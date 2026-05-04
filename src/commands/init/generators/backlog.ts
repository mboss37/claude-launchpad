import type { InitOptions } from "../../../types/index.js";

export function generateBacklogMd(options: InitOptions): string {
  const today = new Date().toISOString().slice(0, 10);
  return `# ${options.name} — Backlog

> **Single source of truth for future work.** Every work package (WP) that's been proposed but not yet started lives here.
>
> Rules (see \`.claude/rules/workflow.md\` for the full lifecycle):
> - Every WP uses the template below — no freeform entries.
> - WPs are **moved** to \`TASKS.md\` when pulled into a sprint, not copied. A WP lives in exactly one file at a time.
> - Priority ordering: **P0 > P1 > P2 > P3**. P0 items sit at the top.
> - A WP ID is minted when the WP is first added here and never reused.

---

## Priority definitions

| Priority | Meaning |
|---|---|
| **P0** | Blocks launch or an active sprint. Next sprint or sooner. |
| **P1** | Important for MVP. Pulled within 2–3 sprints. |
| **P2** | Post-MVP or nice-to-have. Review monthly. |
| **P3** | Parked idea. Review quarterly; delete if still untouched. |

---

## Work package template (copy this exactly)

\`\`\`markdown
### WP-NNN — <short imperative title>

- **Priority:** P0 | P1 | P2 | P3
- **Proposed:** YYYY-MM-DD
- **Stories / Docs:** links to specs, issues, or "none yet"
- **Depends on:** WP-MMM (empty if none)
- **Estimate:** XS (<1h) | S (half-day) | M (1–2 days) | L (full sprint) | XL (>1 sprint; must decompose)
- **Trigger to pull:** What has to be true before this moves into a sprint.
- **Definition of done:** Exactly what "done" looks like.

One-paragraph description. Context, rationale, rough approach if known. Keep it tight.
\`\`\`

**Hard rules for entries:**
- Title is an imperative ("Add referral banner", "Wire up StoreKit upgrade flow") — not a noun.
- \`Trigger to pull\` and \`Definition of done\` are mandatory. A WP without either is incomplete.
- \`XL\` estimates must be broken into multiple WPs before pulling into a sprint.
- WP IDs are minted on first entry and never reused. Check the Changelog below for the highest ID before adding a new one.

---

## P0 — Next sprint

<!-- Empty. WPs appear here when promoted from P1, or when a new blocker surfaces. -->

---

## P1 — Soon (within 2–3 sprints)

<!-- Empty. Add WPs here as sprints approach. -->

---

## P2 — Post-MVP / nice-to-have

<!-- Empty. Review monthly. -->

---

## P3 — Parked

<!-- Empty. Move P2 items here if they survive 2 quarterly reviews without being pulled. -->

---

## Changelog

Capture WP promotions, demotions, and deletions so you can audit backlog drift.

- ${today}: Backlog established.
`;
}
