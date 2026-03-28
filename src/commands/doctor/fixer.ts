import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../../lib/output.js";
import { detectProject } from "../../lib/detect.js";
import { generateClaudeignore } from "../init/generators/claudeignore.js";
import type { DiagnosticIssue, DetectedProject } from "../../types/index.js";

interface FixResult {
  readonly fixed: number;
  readonly skipped: number;
}

/**
 * Auto-apply deterministic fixes for doctor issues.
 * Only applies fixes that are safe and unambiguous.
 */
export async function applyFixes(
  issues: ReadonlyArray<DiagnosticIssue>,
  projectRoot: string,
): Promise<FixResult> {
  const detected = await detectProject(projectRoot);
  let fixed = 0;
  let skipped = 0;

  for (const issue of issues) {
    const applied = await tryFix(issue, projectRoot, detected);
    if (applied) {
      fixed++;
    } else {
      skipped++;
    }
  }

  return { fixed, skipped };
}

async function tryFix(
  issue: DiagnosticIssue,
  root: string,
  detected: DetectedProject,
): Promise<boolean> {
  // ─── Hooks: No hooks at all (create settings.json from scratch) ───
  if (issue.analyzer === "Hooks" && issue.message.includes("No hooks configured")) {
    const a = await addEnvProtectionHook(root);
    const b = await addAutoFormatHook(root, detected);
    const c = await addForcePushProtection(root);
    return a || b || c;
  }

  // ─── Hooks: No .env protection ───
  if (issue.analyzer === "Hooks" && issue.message.includes(".env file protection")) {
    return addEnvProtectionHook(root);
  }

  // ─── Hooks: No auto-format ───
  if (issue.analyzer === "Hooks" && issue.message.includes("auto-format")) {
    return addAutoFormatHook(root, detected);
  }

  // ─── Hooks: No PreToolUse ───
  if (issue.analyzer === "Hooks" && issue.message.includes("No PreToolUse")) {
    return addEnvProtectionHook(root);
  }

  // ─── Quality: Missing Architecture section ───
  if (issue.analyzer === "Quality" && issue.message.includes("Architecture")) {
    return addClaudeMdSection(root, "## Architecture", "<!-- TODO: Describe your codebase structure. Run `claude-launchpad enhance` to auto-fill this. -->");
  }

  // ─── Quality: Missing Off-Limits section ───
  if (issue.analyzer === "Quality" && issue.message.includes("Off-Limits")) {
    return addClaudeMdSection(root, "## Off-Limits", "- Never hardcode secrets — use environment variables\n- Never write to `.env` files\n- Never expose internal error details in API responses");
  }

  // ─── Quality: Missing Commands section ───
  if (issue.analyzer === "Quality" && issue.message.includes("Commands")) {
    return addClaudeMdSection(root, "## Commands", "<!-- TODO: Add your dev/build/test commands -->");
  }

  // ─── Quality: Missing Stack section ───
  if (issue.analyzer === "Quality" && issue.message.includes("Stack")) {
    const stackContent = detected.language
      ? `- **Language**: ${detected.language}${detected.framework ? `\n- **Framework**: ${detected.framework}` : ""}${detected.packageManager ? `\n- **Package Manager**: ${detected.packageManager}` : ""}`
      : "<!-- TODO: Define your tech stack -->";
    return addClaudeMdSection(root, "## Stack", stackContent);
  }

  // ─── Quality: Missing Session Start ───
  if (issue.analyzer === "Quality" && issue.message.includes("Session Start")) {
    return addClaudeMdSection(root, "## Session Start", "- ALWAYS read @TASKS.md first — it tracks progress across sessions\n- Update TASKS.md as you complete work");
  }

  // ─── Rules: No .claudeignore ───
  if (issue.analyzer === "Rules" && issue.message.includes("No .claudeignore")) {
    return createClaudeignore(root, detected);
  }

  // ─── Rules: No rules files ───
  if (issue.analyzer === "Rules" && issue.message.includes("No .claude/rules/")) {
    return createStarterRules(root);
  }

  // ─── Permissions: No force-push protection ───
  if (issue.analyzer === "Permissions" && issue.message.includes("force-push")) {
    return addForcePushProtection(root);
  }

  // Can't auto-fix this one
  return false;
}

// ─── Fix Implementations ───

async function addEnvProtectionHook(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  const preToolUse = (hooks.PreToolUse as Record<string, unknown>[] | undefined) ?? [];

  // Check if already exists
  const alreadyHas = preToolUse.some((g: Record<string, unknown>) => {
    const nested = g.hooks as Record<string, unknown>[] | undefined;
    return nested?.some((h) => String(h.command ?? "").includes(".env"));
  });

  if (alreadyHas) return false;

  preToolUse.push({
    matcher: "Read|Write|Edit",
    hooks: [{
      type: "command",
      command: "echo \"$TOOL_INPUT_FILE_PATH\" | grep -qE '\\.(env|env\\..*)$' && ! echo \"$TOOL_INPUT_FILE_PATH\" | grep -q '.env.example' && echo 'BLOCKED: .env files contain secrets' && exit 1; exit 0",
    }],
  });

  (settings as Record<string, unknown>).hooks = { ...hooks, PreToolUse: preToolUse };
  await writeSettingsJson(root, settings);
  log.success("Added .env file protection hook (PreToolUse)");
  return true;
}

async function addAutoFormatHook(root: string, detected: DetectedProject): Promise<boolean> {
  if (!detected.language) return false;

  const formatters: Record<string, { extensions: string[]; command: string }> = {
    TypeScript: { extensions: ["ts", "tsx"], command: detected.formatCommand ?? "npx prettier --write" },
    JavaScript: { extensions: ["js", "jsx"], command: detected.formatCommand ?? "npx prettier --write" },
    Python: { extensions: ["py"], command: detected.formatCommand ?? "ruff format" },
    Go: { extensions: ["go"], command: "gofmt -w" },
    Rust: { extensions: ["rs"], command: "rustfmt" },
    Ruby: { extensions: ["rb"], command: "rubocop -A" },
    PHP: { extensions: ["php"], command: detected.formatCommand ?? "vendor/bin/pint" },
  };

  const config = formatters[detected.language];
  if (!config) return false;

  const settings = await readSettingsJson(root);
  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  const postToolUse = (hooks.PostToolUse as Record<string, unknown>[] | undefined) ?? [];

  const alreadyHas = postToolUse.some((g: Record<string, unknown>) => {
    const nested = g.hooks as Record<string, unknown>[] | undefined;
    return nested?.some((h) => String(h.command ?? "").includes("format"));
  });

  if (alreadyHas) return false;

  const extChecks = config.extensions.map((ext) => `[ "$ext" = "${ext}" ]`).join(" || ");

  postToolUse.push({
    matcher: "Write|Edit",
    hooks: [{
      type: "command",
      command: `ext=\${TOOL_INPUT_FILE_PATH##*.}; (${extChecks}) && ${config.command} "$TOOL_INPUT_FILE_PATH" 2>/dev/null; exit 0`,
    }],
  });

  (settings as Record<string, unknown>).hooks = { ...hooks, PostToolUse: postToolUse };
  await writeSettingsJson(root, settings);
  log.success(`Added auto-format hook (PostToolUse → ${config.command})`);
  return true;
}

async function addForcePushProtection(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  const preToolUse = (hooks.PreToolUse as Record<string, unknown>[] | undefined) ?? [];

  const alreadyHas = preToolUse.some((g: Record<string, unknown>) => {
    const nested = g.hooks as Record<string, unknown>[] | undefined;
    return nested?.some((h) => String(h.command ?? "").includes("force"));
  });

  if (alreadyHas) return false;

  preToolUse.push({
    matcher: "Bash",
    hooks: [{
      type: "command",
      command: "echo \"$TOOL_INPUT_COMMAND\" | grep -qE 'push.*--force|push.*-f' && echo 'WARNING: Force push detected — this can destroy remote history' && exit 1; exit 0",
    }],
  });

  (settings as Record<string, unknown>).hooks = { ...hooks, PreToolUse: preToolUse };
  await writeSettingsJson(root, settings);
  log.success("Added force-push protection hook (PreToolUse → Bash)");
  return true;
}

async function addClaudeMdSection(root: string, heading: string, content: string): Promise<boolean> {
  const claudeMdPath = join(root, "CLAUDE.md");
  let existing: string;
  try {
    existing = await readFile(claudeMdPath, "utf-8");
  } catch {
    return false; // No CLAUDE.md to add to
  }

  // Don't add if section already exists
  if (existing.includes(heading)) return false;

  // Append before Key Decisions if it exists, otherwise at end
  const keyDecisionsIdx = existing.indexOf("## Key Decisions");
  const insertAt = keyDecisionsIdx > -1 ? keyDecisionsIdx : existing.length;

  const section = `\n${heading}\n${content}\n\n`;
  const updated = existing.slice(0, insertAt) + section + existing.slice(insertAt);

  await writeFile(claudeMdPath, updated);
  log.success(`Added "${heading}" section to CLAUDE.md`);
  return true;
}

async function createClaudeignore(root: string, detected: DetectedProject): Promise<boolean> {
  const ignorePath = join(root, ".claudeignore");
  try {
    await access(ignorePath);
    return false; // Already exists
  } catch {
    // Create it
  }

  const content = generateClaudeignore(detected);
  await writeFile(ignorePath, content);
  log.success("Generated .claudeignore with language-specific ignore patterns");
  return true;
}

async function createStarterRules(root: string): Promise<boolean> {
  const rulesDir = join(root, ".claude", "rules");
  try {
    await access(rulesDir);
    return false; // Already exists
  } catch {
    // Create it
  }

  await mkdir(rulesDir, { recursive: true });

  await writeFile(
    join(rulesDir, "conventions.md"),
    `# Project Conventions

- Use conventional commits (feat:, fix:, docs:, refactor:, test:, chore:)
- Keep files under 400 lines, functions under 50 lines
- Handle errors explicitly — no empty catch blocks
- Validate input at system boundaries
`,
  );

  log.success("Created .claude/rules/conventions.md with starter rules");
  return true;
}

// ─── Settings JSON helpers ───

async function readSettingsJson(root: string): Promise<Record<string, unknown>> {
  const path = join(root, ".claude", "settings.json");
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeSettingsJson(root: string, settings: Record<string, unknown>): Promise<void> {
  const dir = join(root, ".claude");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "settings.json"), JSON.stringify(settings, null, 2) + "\n");
}
