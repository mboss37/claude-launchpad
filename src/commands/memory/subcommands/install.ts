import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { createDatabase, closeDatabase } from '../storage/database.js';
import { migrate } from '../storage/migrator.js';
import { loadConfig, resolveDataDir } from '../config.js';
import { readSettingsJson, writeSettingsJson, readSettingsLocalJson, writeSettingsLocalJson } from '../../../lib/settings.js';
import { getMemoryPlacement } from '../../../lib/memory-placement.js';
import { log } from '../../../lib/output.js';
import type { MemoryPlacement } from '../../../types/index.js';

function isGhAuthenticated(): boolean {
  try {
    execSync('gh auth status', { stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

interface InstallOpts {
  readonly dbPath?: string;
}

export async function runInstall(opts: InstallOpts): Promise<void> {
  log.blank();
  log.step('Setting up your knowledge base');
  log.blank();

  // Step 0: Ensure native deps are installed globally
  await ensureNativeDeps();

  // Prompt for placement before any config writes
  const placement = await getMemoryPlacement(process.cwd());

  const config = loadConfig(opts.dbPath ? { dataDir: opts.dbPath } : undefined);
  const dataDir = resolveDataDir(config.dataDir);

  // Step 1: Database
  log.step('[1/5] Creating knowledge base...');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  const db = createDatabase({ dataDir });
  migrate(db);
  closeDatabase(db);
  log.success(`Knowledge base created at ${dataDir}/memory.db`);

  // Step 2: Configure Claude Code settings
  log.step('[2/5] Connecting to Claude Code...');
  await configureSettings(process.cwd(), placement);

  // Step 3: Register MCP server (project scope for shared, local scope for local)
  log.step('[3/5] Enabling memory tools...');
  const mcpScope = placement === "local" ? "local" : "project";
  const registered = registerMcpServer(mcpScope);
  if (registered) {
    log.success('Memory tools available in Claude Code');
  } else {
    log.warn('Could not enable memory tools automatically.');
    log.info(`Run: claude mcp add --scope ${mcpScope} agentic-memory -- npx claude-launchpad memory serve`);
  }

  // Step 4: CLAUDE.md + skills
  log.step('[4/5] Adding instructions...');
  const guidanceAdded = injectClaudeMdGuidance(process.cwd(), placement);
  if (guidanceAdded) {
    const label = placement === "local" ? ".claude/CLAUDE.md" : "CLAUDE.md";
    log.success(`${label} updated with memory instructions`);
  }
  if (placement === "shared") {
    const skillsInstalled = installSkills(process.cwd());
    if (skillsInstalled > 0) {
      log.success(`Installed ${skillsInstalled} skill(s) to .claude/skills/`);
    }
  }

  log.blank();
  log.success('Knowledge base is ready. Claude will now remember across sessions.');
  log.info('Restart your Claude Code session to activate.');

  // Sync guidance
  if (isGhAuthenticated()) {
    log.info('Cross-device sync available. Run `memory push` to back up, or it auto-syncs each session.');
  } else {
    log.blank();
    log.info('Recommended: install the GitHub CLI for cross-device memory sync:');
    log.step('  https://cli.github.com/');
    log.step('  gh auth login');
  }
  log.blank();
}

export function detectExistingSetup(projectDir: string): MemoryPlacement | null {
  // Check local CLAUDE.md
  try {
    const localClaude = readFileSync(join(projectDir, '.claude', 'CLAUDE.md'), 'utf-8');
    if (localClaude.includes('## Memory') || localClaude.includes('agentic-memory')) return "local";
  } catch { /* not found */ }

  // Check root CLAUDE.md
  try {
    const rootClaude = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf-8');
    if (rootClaude.includes('## Memory (agentic-memory)')) return "shared";
  } catch { /* not found */ }

  return null;
}

async function configureSettings(projectDir: string, placement: MemoryPlacement): Promise<void> {
  const read = placement === "local" ? readSettingsLocalJson : readSettingsJson;
  const write = placement === "local" ? writeSettingsLocalJson : writeSettingsJson;
  const settings = await read(projectDir);

  // Disable built-in auto-memory
  log.info('Built-in auto-memory disabled (replaced by knowledge base)');

  // Build hooks immutably — always add sync hooks (they fail silently without gh)
  const baseHooks = (settings['hooks'] ?? {}) as Record<string, unknown[]>;
  const withPull = addSessionStartPullHook(baseHooks);
  const withContext = addSessionStartHook(withPull);
  const withPush = addSessionEndPushHook(withContext);

  // Build permissions immutably
  const withPermissions = addToolPermissions(settings);

  const updated = {
    ...withPermissions,
    autoMemoryEnabled: false,
    hooks: withPush,
  };

  await write(projectDir, updated);
  const target = placement === "local" ? "settings.local.json" : "settings.json";
  log.success(`Claude Code configured in ${target}`);
}

function addSessionStartPullHook(hooks: Record<string, unknown[]>): Record<string, unknown[]> {
  const sessionStartHooks = (hooks['SessionStart'] ?? []) as Record<string, unknown>[];
  const alreadyHooked = sessionStartHooks.some((h) => {
    const innerHooks = h['hooks'] as Record<string, unknown>[] | undefined;
    return innerHooks?.some(
      ih => typeof ih['command'] === 'string' && (ih['command'] as string).includes('memory pull'),
    );
  });

  if (alreadyHooked) return hooks;

  // Insert at the beginning so pull runs before context injection
  const entry = {
    matcher: 'startup',
    hooks: [{ type: 'command', command: 'claude-launchpad memory pull -y 2>/dev/null; exit 0' }],
  };
  log.info('Session start: memories will auto-pull from GitHub Gist');
  return { ...hooks, SessionStart: [entry, ...sessionStartHooks] };
}

function addSessionStartHook(hooks: Record<string, unknown[]>): Record<string, unknown[]> {
  const sessionStartHooks = (hooks['SessionStart'] ?? []) as Record<string, unknown>[];
  const hookCommand = 'npx claude-launchpad memory context --json 2>/dev/null; exit 0';

  const alreadyHooked = sessionStartHooks.some((h) => {
    const innerHooks = h['hooks'] as Record<string, unknown>[] | undefined;
    return innerHooks?.some(
      ih => typeof ih['command'] === 'string' && (ih['command'] as string).includes('claude-launchpad memory context'),
    );
  });

  if (alreadyHooked) return hooks;

  const entry = {
    matcher: 'startup|resume',
    hooks: [{ type: 'command', command: hookCommand }],
  };
  log.info('Session start: Claude will recall relevant context automatically');
  return { ...hooks, SessionStart: [...sessionStartHooks, entry] };
}

function addSessionEndPushHook(hooks: Record<string, unknown[]>): Record<string, unknown[]> {
  const sessionEndHooks = (hooks['SessionEnd'] ?? []) as Record<string, unknown>[];
  const alreadyHooked = sessionEndHooks.some((h) => {
    const innerHooks = h['hooks'] as Record<string, unknown>[] | undefined;
    return innerHooks?.some(
      ih => typeof ih['command'] === 'string' && (ih['command'] as string).includes('memory push'),
    );
  });

  if (alreadyHooked) return hooks;

  const entry = {
    hooks: [{ type: 'command', command: 'nohup claude-launchpad memory push -y </dev/null >/dev/null 2>&1 & exit 0' }],
  };
  log.info('Session end: memories will auto-push to GitHub Gist');
  return { ...hooks, SessionEnd: [...sessionEndHooks, entry] };
}

function addToolPermissions(settings: Record<string, unknown>): Record<string, unknown> {
  const permissions = (settings['permissions'] ?? {}) as Record<string, unknown>;
  const allowList = (permissions['allow'] ?? []) as readonly string[];

  const memoryTools = [
    'mcp__agentic-memory__memory_store',
    'mcp__agentic-memory__memory_search',
    'mcp__agentic-memory__memory_recent',
    'mcp__agentic-memory__memory_forget',
    'mcp__agentic-memory__memory_relate',
    'mcp__agentic-memory__memory_stats',
    'mcp__agentic-memory__memory_update',
  ];

  const missing = memoryTools.filter((t) => !allowList.includes(t));
  if (missing.length === 0) return settings;

  log.info(`${missing.length} memory tools auto-approved`);
  return {
    ...settings,
    permissions: { ...permissions, allow: [...allowList, ...missing] },
  };
}

async function ensureNativeDeps(): Promise<void> {
  const { cwdRequire } = await import('../utils/require-deps.js');
  try {
    cwdRequire('better-sqlite3');
    return;
  } catch {
    // Not installed — install globally
  }

  log.step('Installing required database libraries...');
  try {
    execSync('npm install -g better-sqlite3 sqlite-vec', { stdio: 'pipe', timeout: 120000 });
    log.success('Database libraries installed');
  } catch {
    log.error('Could not install database libraries automatically.');
    log.blank();
    log.info('Install manually:');
    log.step('  npm install -g better-sqlite3 sqlite-vec');
    log.blank();
    log.info('Requires a C++ compiler (Xcode on macOS, build-essential on Linux).');
    process.exit(1);
  }
}

function registerMcpServer(scope: "project" | "local"): boolean {
  try {
    const existing = execSync('claude mcp list', { stdio: 'pipe', timeout: 10000, encoding: 'utf-8' });
    if (existing.includes('agentic-memory')) {
      log.info('Memory tools already registered');
      return true;
    }
    execSync(
      `claude mcp add --scope ${scope} agentic-memory -- npx claude-launchpad memory serve`,
      { stdio: 'pipe', timeout: 10000 },
    );
    return true;
  } catch {
    return false;
  }
}

const MEMORY_GUIDANCE = `
## Memory (agentic-memory)
This project uses **agentic-memory** for persistent memory across sessions.
- **DO NOT** use the built-in auto-memory system (~/.claude/projects/*/memory/)
- Memory context is **automatically injected** at session start via SessionStart hook - no need to call memory_recent manually
- Use \`memory_search\` to find specific memories by keyword
- Use \`memory_store\` to save decisions, gotchas, and learnings worth remembering
- Use \`memory_stats\` to check memory health
- **STORE IMMEDIATELY** when: a dependency strategy changes, an architecture decision is made, a convention is established, a bug pattern is discovered, or a feature is killed/added
`;

function injectClaudeMdGuidance(projectDir: string, placement: MemoryPlacement): boolean {
  const claudeMdPath = placement === "local"
    ? join(projectDir, '.claude', 'CLAUDE.md')
    : join(projectDir, 'CLAUDE.md');

  let content = '';
  try {
    content = readFileSync(claudeMdPath, 'utf-8');
  } catch {
    if (placement !== "local") return false;
    // Create local .claude/CLAUDE.md
    mkdirSync(join(projectDir, '.claude'), { recursive: true });
    content = '# Local Claude Config\n';
  }

  if (content.includes('## Memory (agentic-memory)')) {
    return false;
  }

  const updated = content.trimEnd() + '\n' + MEMORY_GUIDANCE;
  writeFileSync(claudeMdPath, updated, 'utf-8');
  return true;
}

const MIGRATE_MEMORY_SKILL = `---
name: lp-migrate-memory
description: Migrate legacy Claude Code auto-memory files (~/.claude/projects/*/memory/*.md) into agentic-memory. Use when setting up agentic-memory on a project that already has built-in memories.
allowed-tools: Read, Glob, Grep, mcp__agentic-memory__memory_store, mcp__agentic-memory__memory_search
---

# Migrate Legacy Claude Code Memories

Migrate memory files from Claude Code's built-in auto-memory system into agentic-memory.

## Steps

1. **Find legacy memory files** for this project:
   - Scan \`~/.claude/projects/*/memory/*.md\` for directories whose slug matches the current project path
   - The slug format is the absolute path with \`/\` replaced by \`-\` and leading \`-\` (e.g. \`-Users-john-projects-myapp\`)
   - Also check \`~/.claude/projects/*/memory/team/*.md\` for team memories

2. **For each memory file found**, read it and parse:
   - YAML frontmatter: \`name\`, \`description\`, \`type\` (user/feedback/project/reference)
   - Body content (everything after the frontmatter closing \`---\`)
   - Skip \`MEMORY.md\` (it's just an index file, not a memory)

3. **Before storing**, check for duplicates:
   - Call \`memory_search\` with the memory description or first 100 chars of content
   - If a close match exists (same topic), skip it and report

4. **Map types and store** each memory via \`memory_store\`:
   - \`user\` -> type: \`semantic\`, tags: [\`user\`, \`migrated\`], importance: 0.7
   - \`feedback\` -> type: \`semantic\`, tags: [\`feedback\`, \`migrated\`], importance: 0.8
   - \`project\` -> type: \`semantic\`, tags: [\`project\`, \`migrated\`], importance: 0.6
   - \`reference\` -> type: \`semantic\`, tags: [\`reference\`, \`migrated\`], importance: 0.5
   - Use the frontmatter \`name\` as the title
   - Use the body content as the memory content
   - Set source: \`import\`
   - Adjust importance up/down based on the content (decisions and gotchas deserve higher importance)

5. **Report results**: list what was migrated, what was skipped (duplicates), and what failed

## Important

- Do NOT delete the original files - the user can do that manually after verifying
- Do NOT migrate content that is purely derived from code (architecture, file structure) - it belongs in CLAUDE.md, not memory
- If unsure about a memory's value, migrate it anyway - the decay system will naturally prune low-value memories over time
`;

const SKILLS: Readonly<Record<string, string>> = {
  'lp-migrate-memory': MIGRATE_MEMORY_SKILL,
};

function installSkills(projectDir: string): number {
  const skillsDir = join(projectDir, '.claude', 'skills');
  let installed = 0;

  for (const [name, content] of Object.entries(SKILLS)) {
    const skillDir = join(skillsDir, name);
    const skillPath = join(skillDir, 'SKILL.md');

    if (existsSync(skillPath)) continue;

    mkdirSync(skillDir, { recursive: true });
    writeFileSync(skillPath, content.trimStart(), 'utf-8');
    installed++;
  }

  return installed;
}
