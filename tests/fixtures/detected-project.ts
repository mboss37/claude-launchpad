import type { DetectedProject } from "../../src/types/index.js";

export const fixedDetectedProject: DetectedProject = {
  name: "demo",
  language: "TypeScript",
  framework: "Next.js",
  packageManager: "pnpm",
  hasTests: true,
  hasLinter: true,
  hasFormatter: true,
  formatCommand: "pnpm prettier --write",
  lintCommand: "pnpm lint",
  testCommand: "pnpm test:run",
  devCommand: "pnpm dev",
  buildCommand: "pnpm build",
};
