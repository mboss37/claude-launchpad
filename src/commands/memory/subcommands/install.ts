import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { createDatabase, closeDatabase } from '../storage/database.js';
import { migrate } from '../storage/migrator.js';
import { loadConfig, resolveDataDir } from '../config.js';
import { readSettingsJson, writeSettingsJson } from '../../../lib/settings.js';
import { log } from '../../../lib/output.js';

interface InstallOpts {
  readonly dbPath?: string;
}

export async function runInstall(opts: InstallOpts): Promise<void> {
  log.blank();
  log.step('Memory system - install');
  log.blank();

  const config = loadConfig(opts.dbPath ? { dataDir: opts.dbPath } : undefined);
  const dataDir = resolveDataDir(config.dataDir);

  // Step 1: Database
  log.step('[1/4] Setting up database...');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  const db = createDatabase({ dataDir });
  migrate(db);
  closeDatabase(db);
  log.success(`${dataDir}/memory.db ready`);

  // Step 2: Configure Claude Code settings
  log.step('[2/4] Configuring Claude Code...');
  await configureSettings(process.cwd());

  // Step 3: Register MCP server
  log.step('[3/4] Registering MCP server...');
  const registered = registerMcpServer();
  if (registered) {
    log.success('MCP server registered via `claude mcp add`');
  } else {
    log.warn('Could not register MCP server automatically.');
    log.info('Run: claude mcp add agentic-memory -- npx claude-launchpad memory serve');
  }

  // Step 4: CLAUDE.md + skills
  log.step('[4/4] Injecting guidance...');
  const guidanceAdded = injectClaudeMdGuidance(process.cwd());
  if (guidanceAdded) {
    log.success('Memory guidance added to CLAUDE.md');
  }
  const skillsInstalled = installSkills(process.cwd());
  if (skillsInstalled > 0) {
    log.success(`Installed ${skillsInstalled} skill(s) to .claude/skills/`);
  }

  log.blank();
  log.success('Memory system installed.');
  log.blank();
}

async function configureSettings(projectDir: string): Promise<void> {
  const settings = await readSettingsJson(projectDir);

  // Disable built-in auto-memory
  settings['autoMemoryEnabled'] = false;
  log.info('Built-in auto-memory disabled');

  // SessionStart hook
  const hooks = (settings['hooks'] ?? {}) as Record<string, unknown[]>;
  addSessionStartHook(hooks);
  addStopHook(hooks);
  settings['hooks'] = hooks;

  // Auto-allow MCP tools
  addToolPermissions(settings);

  await writeSettingsJson(projectDir, settings);
  log.success('settings.json updated');
}

function addSessionStartHook(hooks: Record<string, unknown[]>): void {
  const sessionStartHooks = (hooks['SessionStart'] ?? []) as Record<string, unknown>[];
  const hookCommand = 'npx claude-launchpad memory context --json 2>/dev/null; exit 0';

  const alreadyHooked = sessionStartHooks.some((h) => {
    const innerHooks = h['hooks'] as Record<string, unknown>[] | undefined;
    return innerHooks?.some(
      ih => typeof ih['command'] === 'string' && (ih['command'] as string).includes('claude-launchpad memory context'),
    );
  });

  if (!alreadyHooked) {
    sessionStartHooks.push({
      matcher: 'startup|resume',
      hooks: [{ type: 'command', command: hookCommand }],
    });
    hooks['SessionStart'] = sessionStartHooks;
    log.info('SessionStart hook added (injects memory context)');
  }
}

function addStopHook(hooks: Record<string, unknown[]>): void {
  const stopHooks = (hooks['Stop'] ?? []) as Record<string, unknown>[];
  const extractCommand = 'npx claude-launchpad memory extract 2>/dev/null; exit 0';

  const alreadyHasExtract = stopHooks.some((h) => {
    const innerHooks = h['hooks'] as Record<string, unknown>[] | undefined;
    return innerHooks?.some(
      ih => typeof ih['command'] === 'string' && (ih['command'] as string).includes('claude-launchpad memory extract'),
    );
  });

  if (!alreadyHasExtract) {
    stopHooks.push({
      hooks: [{ type: 'command', command: extractCommand, async: true }],
    });
    hooks['Stop'] = stopHooks;
    log.info('Stop hook added (extracts facts from transcript)');
  }
}

function addToolPermissions(settings: Record<string, unknown>): void {
  const permissions = (settings['permissions'] ?? {}) as Record<string, unknown>;
  const allowList = (permissions['allow'] ?? []) as string[];

  const memoryTools = [
    'mcp__agentic-memory__memory_store',
    'mcp__agentic-memory__memory_search',
    'mcp__agentic-memory__memory_recent',
    'mcp__agentic-memory__memory_forget',
    'mcp__agentic-memory__memory_relate',
    'mcp__agentic-memory__memory_stats',
    'mcp__agentic-memory__memory_update',
  ];

  let added = 0;
  for (const tool of memoryTools) {
    if (!allowList.includes(tool)) {
      allowList.push(tool);
      added++;
    }
  }

  if (added > 0) {
    permissions['allow'] = allowList;
    settings['permissions'] = permissions;
    log.info(`Auto-allowed ${added} MCP tools`);
  }
}

function registerMcpServer(): boolean {
  try {
    execSync(
      'claude mcp add agentic-memory -- npx claude-launchpad memory serve',
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
`;

function injectClaudeMdGuidance(projectDir: string): boolean {
  const claudeMdPath = join(projectDir, 'CLAUDE.md');

  let content = '';
  try {
    content = readFileSync(claudeMdPath, 'utf-8');
  } catch {
    return false;
  }

  if (content.includes('## Memory (agentic-memory)')) {
    return false;
  }

  const updated = content.trimEnd() + '\n' + MEMORY_GUIDANCE;
  writeFileSync(claudeMdPath, updated, 'utf-8');
  return true;
}

const MIGRATE_MEMORY_SKILL = `---
name: migrate-memory
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
  'migrate-memory': MIGRATE_MEMORY_SKILL,
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
