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

// Fix lookup table: [analyzer, message substring] → fix function
type FixFn = (root: string, detected: DetectedProject) => Promise<boolean>;

const FIX_TABLE: ReadonlyArray<{ analyzer: string; match: string; fix: FixFn }> = [
  { analyzer: "Hooks", match: "No hooks configured", fix: async (root, detected) => {
    const a = await addEnvProtectionHook(root);
    const b = await addAutoFormatHook(root, detected);
    const c = await addForcePushProtection(root);
    return a || b || c;
  }},
  { analyzer: "Hooks", match: ".env file protection", fix: (root) => addEnvProtectionHook(root) },
  { analyzer: "Hooks", match: "auto-format", fix: (root, detected) => addAutoFormatHook(root, detected) },
  { analyzer: "Hooks", match: "No PreToolUse", fix: (root) => addEnvProtectionHook(root) },
  { analyzer: "Quality", match: "Architecture", fix: (root) => addClaudeMdSection(root, "## Architecture", "<!-- TODO: Describe your codebase structure. Run `claude-launchpad enhance` to auto-fill this. -->") },
  { analyzer: "Quality", match: "Off-Limits", fix: (root) => addClaudeMdSection(root, "## Off-Limits", "- Never hardcode secrets - use environment variables\n- Never write to `.env` files\n- Never expose internal error details in API responses") },
  { analyzer: "Quality", match: "Commands", fix: (root) => addClaudeMdSection(root, "## Commands", "<!-- TODO: Add your dev/build/test commands -->") },
  { analyzer: "Quality", match: "Stack", fix: (root, detected) => {
    const content = detected.language
      ? `- **Language**: ${detected.language}${detected.framework ? `\n- **Framework**: ${detected.framework}` : ""}${detected.packageManager ? `\n- **Package Manager**: ${detected.packageManager}` : ""}`
      : "<!-- TODO: Define your tech stack -->";
    return addClaudeMdSection(root, "## Stack", content);
  }},
  { analyzer: "Quality", match: "Session Start", fix: (root) => addClaudeMdSection(root, "## Session Start", "- ALWAYS read @TASKS.md first - it tracks progress across sessions\n- Update TASKS.md as you complete work") },
  { analyzer: "Rules", match: "No .claudeignore", fix: (root, detected) => createClaudeignore(root, detected) },
  { analyzer: "Rules", match: "No .claude/rules/", fix: (root) => createStarterRules(root) },
  { analyzer: "Quality", match: "Memory", fix: (root) => addClaudeMdSection(root, "## Memory & Learnings", "Use the built-in memory system to persist knowledge across sessions:\n- **Save immediately** when you discover: a non-obvious fix, a gotcha, an external resource, a decision with context that would be lost, or a known issue to fix later\n- **Categories**: `decision` (why X over Y), `gotcha` (non-obvious pitfall), `deferred` (known issue, not urgent), `reference` (where to find things)\n- **Where**: project memory for this repo, global memory for cross-project learnings\n- **Format**: one fact per memory, include date and why — not just what\n- **Prune**: check if a memory on this topic exists before saving — update, don't duplicate\n- Before starting work, check memory for relevant context from previous sessions") },
  { analyzer: "Hooks", match: "PostCompact", fix: (root) => addPostCompactHook(root) },
  { analyzer: "Permissions", match: "force-push", fix: (root) => addForcePushProtection(root) },
  { analyzer: "Permissions", match: "Credential files not blocked", fix: (root) => addCredentialDenyRules(root) },
  { analyzer: "Permissions", match: "Bypass permissions mode", fix: (root) => addBypassDisable(root) },
  { analyzer: "Permissions", match: "Sandbox not enabled", fix: (root) => addSandboxSettings(root) },
  { analyzer: "Permissions", match: ".env is protected by hooks but not in .claudeignore", fix: (root) => addEnvToClaudeignore(root) },
];

async function tryFix(
  issue: DiagnosticIssue,
  root: string,
  detected: DetectedProject,
): Promise<boolean> {
  const entry = FIX_TABLE.find(
    (e) => e.analyzer === issue.analyzer && issue.message.includes(e.match),
  );
  return entry ? entry.fix(root, detected) : false;
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

  // Safe formatter commands only — never use detected.formatCommand to prevent injection
  const formatters: Record<string, { extensions: string[]; command: string }> = {
    TypeScript: { extensions: ["ts", "tsx"], command: "npx prettier --write" },
    JavaScript: { extensions: ["js", "jsx"], command: "npx prettier --write" },
    Python: { extensions: ["py"], command: "ruff format" },
    Go: { extensions: ["go"], command: "gofmt -w" },
    Rust: { extensions: ["rs"], command: "rustfmt" },
    Ruby: { extensions: ["rb"], command: "rubocop -A" },
    PHP: { extensions: ["php"], command: "vendor/bin/pint" },
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

async function addPostCompactHook(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  const postCompact = (hooks.PostCompact as Record<string, unknown>[] | undefined) ?? [];

  const alreadyHas = postCompact.length > 0;
  if (alreadyHas) return false;

  postCompact.push({
    matcher: "",
    hooks: [{
      type: "command",
      command: "cat TASKS.md 2>/dev/null; exit 0",
    }],
  });

  (settings as Record<string, unknown>).hooks = { ...hooks, PostCompact: postCompact };
  await writeSettingsJson(root, settings);
  log.success("Added PostCompact hook (re-injects TASKS.md after compaction)");
  return true;
}

async function addCredentialDenyRules(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  const permissions = (settings.permissions ?? {}) as Record<string, unknown>;
  const deny = (permissions.deny as string[] | undefined) ?? [];

  const toAdd = ["Read(~/.ssh/*)", "Read(~/.aws/*)", "Read(~/.npmrc)"];
  const missing = toAdd.filter((p) => !deny.includes(p));
  if (missing.length === 0) return false;

  (settings as Record<string, unknown>).permissions = { ...permissions, deny: [...deny, ...missing] };
  await writeSettingsJson(root, settings);
  log.success("Added credential deny rules (SSH, AWS, npm)");
  return true;
}

async function addBypassDisable(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  if (settings.disableBypassPermissionsMode === "disable") return false;

  (settings as Record<string, unknown>).disableBypassPermissionsMode = "disable";
  await writeSettingsJson(root, settings);
  log.success("Added disableBypassPermissionsMode: disable");
  return true;
}

async function addSandboxSettings(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  const sandbox = settings.sandbox as Record<string, unknown> | undefined;
  if (sandbox?.enabled === true) return false;

  (settings as Record<string, unknown>).sandbox = { enabled: true, failIfUnavailable: true };
  await writeSettingsJson(root, settings);
  log.success("Enabled sandbox with failIfUnavailable");
  return true;
}

async function addEnvToClaudeignore(root: string): Promise<boolean> {
  const ignorePath = join(root, ".claudeignore");
  let content: string;
  try {
    content = await readFile(ignorePath, "utf-8");
  } catch {
    return false; // No .claudeignore to modify
  }

  const lines = content.split("\n").map((l) => l.trim());
  if (lines.some((l) => l === ".env" || l === ".env.*" || l === ".env*")) return false;

  await writeFile(ignorePath, content.trimEnd() + "\n.env\n.env.*\n");
  log.success("Added .env to .claudeignore");
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
