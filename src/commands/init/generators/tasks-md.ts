import type { InitOptions } from "../../../types/index.js";

export function generateTasksMd(options: InitOptions): string {
  return `# ${options.name} — Task Tracker

> Claude: Read this at session start. Keep this file SHORT — only current state matters.
> Rules: (1) Only show current + next sprint tasks. (2) Completed sprints get one summary line. (3) Session log: max 3 lines per session, keep only last 3 sessions. (4) Target: under 80 lines total.

## Completed Sprints

## Current Sprint: Sprint 1 — Setup

### In Progress

### To Do
- [ ] Project scaffolding and environment setup
- [ ] Core feature implementation
- [ ] Test infrastructure

### Done

## Deferred
<!-- Known issues not urgent enough for the current sprint. Include date and reason. -->

## Next Sprint: Sprint 2 — Core Features
- [ ] ...

## Session Log
<!-- Keep last 3 sessions only. Max 3 lines each. -->
`;
}
