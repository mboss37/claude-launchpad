import { describe, it, expect } from "vitest";
import { generateHooksRule, HOOKS_RULE_VERSION } from "../src/commands/init/generators/hooks-rule.js";
import { hasEnvVarHookPattern } from "../src/lib/hook-input.js";

describe("generateHooksRule", () => {
  it("uses path-scoped YAML frontmatter targeting settings files", () => {
    const out = generateHooksRule();
    expect(out).toMatch(/^---\npaths: \[".claude\/settings.json", ".claude\/settings.local.json"\]\n---/);
  });

  it("includes a version tag matching HOOKS_RULE_VERSION", () => {
    const out = generateHooksRule();
    expect(out).toContain(`<!-- lp-hooks-version: ${HOOKS_RULE_VERSION} -->`);
  });

  it("explicitly forbids $TOOL_INPUT_* env vars", () => {
    const out = generateHooksRule();
    expect(out).toMatch(/no\s+`?TOOL_INPUT_\*`? environment variables/i);
  });

  it("explains exit 2 vs exit 1 (the most common authoring bug)", () => {
    const out = generateHooksRule();
    expect(out).toMatch(/`exit 1`[^\n]*does NOT block|`exit 1`[^\n]*non-blocking/i);
    expect(out).toContain("exit 2");
    expect(out).toMatch(/[Bb]lock the action/);
  });

  it("documents the multi-hook same-matcher caveat", () => {
    const out = generateHooksRule();
    expect(out).toMatch(/same matcher/i);
    expect(out).toMatch(/single entry's `?hooks`? array/i);
  });

  it("documents the no-hot-reload behavior", () => {
    const out = generateHooksRule();
    expect(out).toMatch(/restart/i);
    expect(out).toMatch(/Hot-reload|hot reload/);
  });

  it("provides canonical templates with jq+stdin", () => {
    const out = generateHooksRule();
    expect(out).toContain(`jq -r '.tool_input.command`);
    expect(out).toContain(`jq -r '.tool_input.file_path`);
  });

  it("the rule itself contains zero $TOOL_INPUT_* references in code blocks (would be hypocritical)", () => {
    const out = generateHooksRule();
    // The rule explicitly mentions $TOOL_INPUT_* in prose ("Don't reference $TOOL_INPUT_COMMAND...")
    // so we can't run hasEnvVarHookPattern on the whole file. But code fences should be clean.
    const codeBlocks = out.match(/```[\s\S]*?```/g) ?? [];
    for (const block of codeBlocks) {
      expect(hasEnvVarHookPattern(block)).toBe(false);
    }
  });

  it("references the official Claude Code docs URL", () => {
    const out = generateHooksRule();
    expect(out).toContain("https://code.claude.com/docs/en/hooks");
  });
});
