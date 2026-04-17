import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { log } from "../../lib/output.js";
import {
  SESSION_START_CONTENT, BACKLOG_CONTENT, STOP_AND_SWARM_CONTENT,
  OFF_LIMITS_CONTENT, SKILL_AUTHORING_CONTENT,
} from "../../lib/sections.js";
import { fileExists } from "../../lib/fs-utils.js";
import { detectProject } from "../../lib/detect.js";
import { generateClaudeignore } from "../init/generators/claudeignore.js";
import { generateEnhanceSkill } from "../init/generators/skill-enhance.js";
import { readSettingsJson, writeSettingsJson } from "../../lib/settings.js";
import { getMemoryPlacement } from "../../lib/memory-placement.js";
import { wrapStub } from "../../lib/stub-marker.js";
import {
  disableAutoMemory, addMemoryToolPermissions, addAllowedMcpServers,
  addSessionStartPullHook, addSessionEndPushHook, upgradeStaleSessionEndPushHook, removeStaleStopHook,
} from "./fixer-memory.js";
import type { DiagnosticIssue, DetectedProject, MemoryPlacement } from "../../types/index.js";

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
  const hasMemoryIssues = issues.some((i) => i.analyzer === "Memory");
  const placement = hasMemoryIssues ? await getMemoryPlacement(projectRoot) : "shared";
  let fixed = 0;
  let skipped = 0;

  for (const issue of issues) {
    const applied = await tryFix(issue, projectRoot, detected, placement);
    if (applied) {
      fixed++;
    } else {
      skipped++;
    }
  }

  return { fixed, skipped };
}

// Fix lookup table: [analyzer, message substring] → fix function
type FixFn = (root: string, detected: DetectedProject, placement: MemoryPlacement) => Promise<boolean>;

const FIX_TABLE: ReadonlyArray<{ analyzer: string; match: string; fix: FixFn }> = [
  { analyzer: "Hooks", match: "No hooks configured", fix: async (root, detected) => {
    const a = await addEnvProtectionHook(root);
    const b = await addAutoFormatHook(root, detected);
    const c = await addForcePushProtection(root);
    const d = await addSessionStartHook(root);
    return a || b || c || d;
  }},
  { analyzer: "Hooks", match: ".env file protection", fix: (root) => addEnvProtectionHook(root) },
  { analyzer: "Hooks", match: "auto-format", fix: (root, detected) => addAutoFormatHook(root, detected) },
  { analyzer: "Hooks", match: "No PreToolUse", fix: (root) => addEnvProtectionHook(root) },
  { analyzer: "Quality", match: "Architecture", fix: (root) => addClaudeMdSection(root, "## Architecture", wrapStub("<!-- TODO: Describe your codebase structure. Run `/lp-enhance` to auto-fill this. -->")) },
  { analyzer: "Quality", match: "Off-Limits", fix: (root) => addClaudeMdSection(root, "## Off-Limits", wrapStub(OFF_LIMITS_CONTENT)) },
  { analyzer: "Quality", match: "Commands", fix: (root) => addClaudeMdSection(root, "## Commands", wrapStub("<!-- TODO: Add your dev/build/test commands -->")) },
  { analyzer: "Quality", match: "Stack", fix: (root, detected) => {
    // Detected stack is real content; TODO fallback is a stub.
    if (detected.language) {
      const content = `- **Language**: ${detected.language}${detected.framework ? `\n- **Framework**: ${detected.framework}` : ""}${detected.packageManager ? `\n- **Package Manager**: ${detected.packageManager}` : ""}`;
      return addClaudeMdSection(root, "## Stack", content);
    }
    return addClaudeMdSection(root, "## Stack", wrapStub("<!-- TODO: Define your tech stack -->"));
  }},
  { analyzer: "Quality", match: "Session Start", fix: (root) => addClaudeMdSection(root, "## Session Start", wrapStub(SESSION_START_CONTENT)) },
  { analyzer: "Quality", match: "Backlog", fix: (root) => addClaudeMdSection(root, "## Backlog", wrapStub(BACKLOG_CONTENT)) },
  { analyzer: "Quality", match: "Stop-and-Swarm", fix: (root) => addClaudeMdSection(root, "## Stop-and-Swarm", wrapStub(STOP_AND_SWARM_CONTENT)) },
  { analyzer: "Rules", match: "No BACKLOG.md", fix: (root) => createBacklogMd(root) },
  { analyzer: "Rules", match: "No .claudeignore", fix: (root, detected) => createClaudeignore(root, detected) },
  { analyzer: "Rules", match: "No .claude/rules/", fix: (root) => createStarterRules(root) },
  { analyzer: "Hooks", match: "PostCompact", fix: (root) => addPostCompactHook(root) },
  { analyzer: "Permissions", match: "force-push", fix: (root) => addForcePushProtection(root) },
  { analyzer: "Permissions", match: "Credential files not blocked", fix: (root) => addCredentialDenyRules(root) },
  { analyzer: "Permissions", match: "Bypass permissions mode", fix: (root) => addBypassDisable(root) },
  { analyzer: "Permissions", match: "Sandbox not enabled", fix: (root) => addSandboxSettings(root) },
  { analyzer: "Permissions", match: ".env is protected by hooks but not in .claudeignore", fix: (root) => addEnvToClaudeignore(root) },
  { analyzer: "Rules", match: "No skill authoring conventions", fix: (root) => addSkillAuthoringConventions(root) },
  { analyzer: "Rules", match: "No /lp-enhance skill", fix: (root) => createEnhanceSkill(root) },
  { analyzer: "Rules", match: "lp-enhance skill is outdated", fix: (root) => updateEnhanceSkill(root) },
  { analyzer: "Settings", match: "Deprecated includeCoAuthoredBy", fix: (root) => migrateAttribution(root) },
  { analyzer: "Hooks", match: "SessionStart", fix: (root) => addSessionStartHook(root) },
  { analyzer: "Memory", match: "Deprecated Stop hook", fix: (root) => removeStaleStopHook(root) },
  { analyzer: "Memory", match: "autoMemoryEnabled not disabled", fix: (root, _det, placement) => disableAutoMemory(root, placement) },
  { analyzer: "Memory", match: "MCP tool permission", fix: (root, _det, placement) => addMemoryToolPermissions(root, placement) },
  { analyzer: "MCP", match: "no allowedMcpServers", fix: (root, _det, placement) => addAllowedMcpServers(root, placement) },
  { analyzer: "Memory", match: "SessionStart hook to auto-pull", fix: (root, _det, placement) => addSessionStartPullHook(root, placement) },
  { analyzer: "Memory", match: "SessionEnd hook to auto-push", fix: (root, _det, placement) => addSessionEndPushHook(root, placement) },
  { analyzer: "Memory", match: "SessionEnd push hook is backgrounded", fix: (root) => upgradeStaleSessionEndPushHook(root) },
  { analyzer: "Memory", match: "CLAUDE.md missing memory guidance", fix: (root, _det, placement) => {
    const content = "Use agentic-memory to persist knowledge across sessions:\n- Memories are automatically injected at session start\n- STORE IMMEDIATELY when: a dependency strategy changes, an architecture decision is made, a convention is established, a bug pattern is discovered, or a feature is killed/added\n- Use memory_search before memory_store to check for duplicates\n- NEVER store credentials, API keys, tokens, or secrets in memories";
    const target = placement === "local" ? join(root, ".claude", "CLAUDE.md") : undefined;
    return addClaudeMdSection(root, "## Memory", wrapStub(content), target);
  }},
];

export function hasAutoFix(issue: DiagnosticIssue): boolean {
  return FIX_TABLE.some(
    (e) => e.analyzer === issue.analyzer && issue.message.includes(e.match),
  );
}

async function tryFix(
  issue: DiagnosticIssue,
  root: string,
  detected: DetectedProject,
  placement: MemoryPlacement,
): Promise<boolean> {
  const entry = FIX_TABLE.find(
    (e) => e.analyzer === issue.analyzer && issue.message.includes(e.match),
  );
  return entry ? entry.fix(root, detected, placement) : false;
}

// ─── Hook Helper ───

async function addHook(
  root: string,
  event: string,
  dedupKeyword: string,
  entry: Record<string, unknown>,
  successMsg: string,
): Promise<boolean> {
  const settings = await readSettingsJson(root);
  const hooks = (settings.hooks ?? {}) as Record<string, unknown>;
  const hookList = (hooks[event] as Record<string, unknown>[] | undefined) ?? [];

  const alreadyHas = hookList.some((g: Record<string, unknown>) => {
    const nested = g.hooks as Record<string, unknown>[] | undefined;
    return nested?.some((h) => String(h.command ?? "").includes(dedupKeyword));
  });
  if (alreadyHas) return false;

  const updated = [...hookList, entry];
  const updatedSettings = { ...settings, hooks: { ...hooks, [event]: updated } };
  await writeSettingsJson(root, updatedSettings);
  log.success(successMsg);
  return true;
}

// ─── Fix Implementations ───

async function addEnvProtectionHook(root: string): Promise<boolean> {
  return addHook(root, "PreToolUse", ".env", {
    matcher: "Read|Write|Edit",
    hooks: [{
      type: "command",
      command: "echo \"$TOOL_INPUT_FILE_PATH\" | grep -qE '\\.(env|env\\..*)$' && ! echo \"$TOOL_INPUT_FILE_PATH\" | grep -q '.env.example' && echo 'BLOCKED: .env files contain secrets' && exit 1; exit 0",
    }],
  }, "Added .env file protection hook (PreToolUse)");
}

async function addAutoFormatHook(root: string, detected: DetectedProject): Promise<boolean> {
  if (!detected.language) return false;

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

  const extChecks = config.extensions.map((ext) => `[ "$ext" = "${ext}" ]`).join(" || ");
  return addHook(root, "PostToolUse", "format", {
    matcher: "Write|Edit",
    hooks: [{
      type: "command",
      command: `ext=\${TOOL_INPUT_FILE_PATH##*.}; (${extChecks}) && ${config.command} "$TOOL_INPUT_FILE_PATH" 2>/dev/null; exit 0`,
    }],
  }, `Added auto-format hook (PostToolUse → ${config.command})`);
}

async function addForcePushProtection(root: string): Promise<boolean> {
  return addHook(root, "PreToolUse", "force", {
    matcher: "Bash",
    hooks: [{
      type: "command",
      command: "echo \"$TOOL_INPUT_COMMAND\" | grep -qE 'push.*--force|push.*-f' && echo 'WARNING: Force push detected — this can destroy remote history' && exit 1; exit 0",
    }],
  }, "Added force-push protection hook (PreToolUse → Bash)");
}

async function addPostCompactHook(root: string): Promise<boolean> {
  return addHook(root, "PostCompact", "TASKS.md", {
    matcher: "",
    hooks: [{
      type: "command",
      command: "cat TASKS.md 2>/dev/null; exit 0",
    }],
  }, "Added PostCompact hook (re-injects TASKS.md after compaction)");
}

async function addSessionStartHook(root: string): Promise<boolean> {
  return addHook(root, "SessionStart", "TASKS.md", {
    matcher: "startup|resume",
    hooks: [{
      type: "command",
      command: "cat TASKS.md 2>/dev/null; exit 0",
    }],
  }, "Added SessionStart hook (injects TASKS.md at startup)");
}

async function migrateAttribution(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  if (settings.includeCoAuthoredBy === undefined) return false;

  const { includeCoAuthoredBy: _, ...rest } = settings;
  const updated = { ...rest, attribution: { commit: "", pr: "" } };
  await writeSettingsJson(root, updated);
  log.success("Migrated includeCoAuthoredBy → attribution object");
  return true;
}

async function addCredentialDenyRules(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  const permissions = (settings.permissions ?? {}) as Record<string, unknown>;
  const deny = (permissions.deny as string[] | undefined) ?? [];

  const toAdd = ["Read(~/.ssh/*)", "Read(~/.aws/*)", "Read(~/.npmrc)"];
  const missing = toAdd.filter((p) => !deny.includes(p));
  if (missing.length === 0) return false;

  const updated = { ...settings, permissions: { ...permissions, deny: [...deny, ...missing] } };
  await writeSettingsJson(root, updated);
  log.success("Added credential deny rules (SSH, AWS, npm)");
  return true;
}

async function addBypassDisable(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  if (settings.disableBypassPermissionsMode === "disable") return false;

  const updated = { ...settings, disableBypassPermissionsMode: "disable" };
  await writeSettingsJson(root, updated);
  log.success("Added disableBypassPermissionsMode: disable");
  return true;
}

async function addSandboxSettings(root: string): Promise<boolean> {
  const settings = await readSettingsJson(root);
  const sandbox = settings.sandbox as Record<string, unknown> | undefined;
  if (sandbox?.enabled === true) return false;

  const updated = { ...settings, sandbox: { enabled: true, failIfUnavailable: true } };
  await writeSettingsJson(root, updated);
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

async function addClaudeMdSection(root: string, heading: string, content: string, targetPath?: string): Promise<boolean> {
  const claudeMdPath = targetPath ?? join(root, "CLAUDE.md");
  let existing: string;
  try {
    existing = await readFile(claudeMdPath, "utf-8");
  } catch {
    if (!targetPath) return false; // No root CLAUDE.md to add to
    // Create local .claude/CLAUDE.md
    await mkdir(join(root, ".claude"), { recursive: true });
    existing = "# Local Claude Config\n";
  }

  // Don't add if section already exists
  if (existing.includes(heading)) return false;

  // Append before Key Decisions if it exists, otherwise at end
  const keyDecisionsIdx = existing.indexOf("## Key Decisions");
  const insertAt = keyDecisionsIdx > -1 ? keyDecisionsIdx : existing.length;

  const section = `\n${heading}\n${content}\n\n`;
  const updated = existing.slice(0, insertAt) + section + existing.slice(insertAt);

  await writeFile(claudeMdPath, updated);
  const label = targetPath ? ".claude/CLAUDE.md" : "CLAUDE.md";
  log.success(`Added "${heading}" section to ${label}`);
  return true;
}

async function createBacklogMd(root: string): Promise<boolean> {
  const backlogPath = join(root, "BACKLOG.md");
  try {
    await access(backlogPath);
    return false;
  } catch {
    // Create it
  }

  const name = root.split("/").pop() ?? "Project";
  await writeFile(backlogPath, `# ${name} - Backlog

> Features discussed but deferred. Pick up when relevant.
> Priority: P0 = next sprint, P1 = soon, P2 = when relevant.
`);
  log.success("Generated BACKLOG.md");
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

const SKILL_AUTHORING_SECTION = `\n## Skill Authoring\n\n${SKILL_AUTHORING_CONTENT}\n`;

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
${SKILL_AUTHORING_SECTION}`,
  );

  log.success("Created .claude/rules/conventions.md with starter rules");
  return true;
}

async function addSkillAuthoringConventions(root: string): Promise<boolean> {
  const conventionsPath = join(root, ".claude", "rules", "conventions.md");
  let content: string;
  try {
    content = await readFile(conventionsPath, "utf-8");
  } catch {
    // No conventions.md — createStarterRules will handle it
    return false;
  }

  if (/^##\s+Skill\s+Authoring/im.test(content)) return false;

  await writeFile(conventionsPath, content.trimEnd() + "\n" + SKILL_AUTHORING_SECTION);
  log.success("Added Skill Authoring section to .claude/rules/conventions.md");
  return true;
}

async function createEnhanceSkill(root: string): Promise<boolean> {
  const skillDir = join(root, ".claude", "skills", "lp-enhance");
  const skillPath = join(skillDir, "SKILL.md");
  const globalPath = join(homedir(), ".claude", "skills", "lp-enhance", "SKILL.md");
  // Also check legacy commands/ location
  const legacyProject = join(root, ".claude", "commands", "lp-enhance.md");
  const legacyGlobal = join(homedir(), ".claude", "commands", "lp-enhance.md");

  if (await fileExists(skillPath) || await fileExists(globalPath)
    || await fileExists(legacyProject) || await fileExists(legacyGlobal)) return false;

  await mkdir(skillDir, { recursive: true });
  await writeFile(skillPath, generateEnhanceSkill());
  log.success("Generated /lp-enhance skill (.claude/skills/lp-enhance/)");
  return true;
}

async function updateEnhanceSkill(root: string): Promise<boolean> {
  // Update whichever location has the skill installed
  const projectPath = join(root, ".claude", "skills", "lp-enhance", "SKILL.md");
  const globalPath = join(homedir(), ".claude", "skills", "lp-enhance", "SKILL.md");

  const targetPath = await fileExists(projectPath) ? projectPath
    : await fileExists(globalPath) ? globalPath
    : null;

  if (!targetPath) return false;

  await writeFile(targetPath, generateEnhanceSkill());
  log.success("Updated /lp-enhance skill to latest version");
  return true;
}


