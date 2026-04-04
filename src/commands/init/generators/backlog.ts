import type { InitOptions } from "../../../types/index.js";

export function generateBacklogMd(options: InitOptions): string {
  return `# ${options.name} - Backlog

> Features discussed but deferred. Pick up when relevant.
> Priority: P0 = next sprint, P1 = soon, P2 = when relevant.

<!-- Add deferred features here. Format:
## [P1] Feature Name
One-line description. Context for why it was deferred and when to revisit.
-->
`;
}
