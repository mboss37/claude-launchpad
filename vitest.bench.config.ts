import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: ".",
    include: ["tests/memory/benchmarks/**/*.bench.ts"],
  },
});
