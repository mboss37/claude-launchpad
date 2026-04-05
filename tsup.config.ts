import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/commands/memory/server.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: [
    "@anthropic-ai/claude-agent-sdk",
    "better-sqlite3",
    "sqlite-vec",
    "@modelcontextprotocol/sdk",
    "zod",
    "react",
    "react/jsx-runtime",
    "ink",
    "ink-text-input",
    "ink-select-input",
    "ink-spinner",
  ],
});
