import type { InitOptions } from "../../../types/index.js";

export function generateTasksMd(options: InitOptions): string {
  return `# ${options.name} — Task Tracker

> Claude: Read at session start. Keep SHORT — only current state matters.
> Completed sprints: one-liner. Session log: 3 lines max, last 3 sessions. Under 80 lines.

## Completed Sprints

## Current: Sprint 1 — Setup
- [ ] Project scaffolding and environment setup
- [ ] Core feature implementation
- [ ] Test infrastructure

## Session Log
`;
}
