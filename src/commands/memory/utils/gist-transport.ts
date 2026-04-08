import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { homedir } from 'node:os';

export interface SyncConfig {
  readonly gistId: string;
}

const EXEC_OPTS = { encoding: 'utf-8' as const, timeout: 30_000 };
const GIST_DESCRIPTION = 'agentic-memory sync';
const SYNC_CONFIG_FILE = 'sync-config.json';
const DATA_DIR = join(homedir(), '.agentic-memory');

function syncConfigPath(): string {
  return join(DATA_DIR, SYNC_CONFIG_FILE);
}

function slugify(project: string): string {
  return project.replace(/[^a-zA-Z0-9._-]/g, '-');
}

export function projectToFilename(project: string): string {
  if (!project) throw new Error('Project name cannot be empty');
  return `memories-${slugify(project)}.json`;
}

export function filenameToProject(filename: string): string | null {
  const match = filename.match(/^memories-(.+)\.json$/);
  return match?.[1] ?? null;
}


export function assertGhAvailable(): void {
  try {
    execSync('gh --version', { ...EXEC_OPTS, stdio: 'pipe' });
  } catch {
    throw new Error(
      'Memory sync requires the GitHub CLI.\n' +
      'Install: https://cli.github.com/\n' +
      'Then run: gh auth login'
    );
  }
  try {
    execSync('gh auth status', { ...EXEC_OPTS, stdio: 'pipe' });
  } catch {
    throw new Error(
      'gh is installed but not authenticated.\n' +
      'Run: gh auth login'
    );
  }
}

/**
 * Read sync config from disk only — no network discovery.
 * Safe to call from lightweight contexts like doctor analyzers.
 */
export function readSyncConfig(): SyncConfig | null {
  try {
    const raw = readFileSync(syncConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.gistId === 'string' && /^[a-f0-9]+$/.test(parsed.gistId)) {
      return { gistId: parsed.gistId };
    }
  } catch { /* no config file */ }
  return null;
}

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = readFileSync(syncConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.gistId === 'string' && /^[a-f0-9]+$/.test(parsed.gistId)) {
      return { gistId: parsed.gistId };
    }
  } catch { /* no local config */ }

  const discovered = discoverSyncGist();
  if (discovered) {
    saveSyncConfig({ gistId: discovered });
    return { gistId: discovered };
  }
  return null;
}

function discoverSyncGist(): string | null {
  try {
    const output = execSync(
      'gh gist list --limit 100',
      { ...EXEC_OPTS, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    for (const line of output.split('\n')) {
      const cols = line.split('\t');
      if (cols[1]?.trim() === GIST_DESCRIPTION) {
        const gistId = cols[0]?.trim();
        if (gistId && /^[a-f0-9]+$/.test(gistId)) return gistId;
      }
    }
  } catch { /* gh list failed */ }
  return null;
}

export function saveSyncConfig(config: SyncConfig): void {
  const filePath = syncConfigPath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function createGist(filename: string, content: string): string {
  const safeFilename = slugify(filename.replace(/\.json$/, '')) + '.json';
  const tmpFile = join(tmpdir(), safeFilename);
  try {
    writeFileSync(tmpFile, content, 'utf-8');
    const result = execSync(
      `gh gist create "${tmpFile}" --desc "${GIST_DESCRIPTION}" --public=false`,
      { ...EXEC_OPTS, stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    const gistId = result.split('/').pop()?.trim() ?? '';
    if (!gistId || !/^[a-f0-9]+$/.test(gistId)) {
      throw new Error(`Failed to parse gist ID from: ${result}`);
    }
    saveSyncConfig({ gistId });
    return gistId;
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

export function readGistFile(gistId: string, filename: string): string | null {
  try {
    const escapedFilename = JSON.stringify(filename);
    return execSync(
      `gh api "/gists/${gistId}" --jq '.files[${escapedFilename}].content'`,
      { ...EXEC_OPTS, stdio: ['pipe', 'pipe', 'pipe'] },
    ).trimEnd();
  } catch {
    return null;
  }
}

export function listGistFiles(gistId: string): readonly string[] {
  try {
    const output = execSync(
      `gh api "/gists/${gistId}" --jq '.files | keys[]'`,
      { ...EXEC_OPTS, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function deleteGistFile(gistId: string, filename: string): void {
  const payload = { files: { [filename]: null } };
  const tmpFile = join(tmpdir(), `gist-delete-${Date.now()}.json`);
  try {
    writeFileSync(tmpFile, JSON.stringify(payload), 'utf-8');
    execSync(
      `gh api --method PATCH "/gists/${gistId}" --input "${tmpFile}"`,
      { ...EXEC_OPTS, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

export function updateGistFiles(
  gistId: string,
  files: Record<string, string>,
): void {
  const payload = {
    files: Object.fromEntries(
      Object.entries(files).map(([name, content]) => [name, { content }]),
    ),
  };
  const tmpFile = join(tmpdir(), `gist-patch-${Date.now()}.json`);
  try {
    writeFileSync(tmpFile, JSON.stringify(payload), 'utf-8');
    execSync(
      `gh api --method PATCH "/gists/${gistId}" --input "${tmpFile}"`,
      { ...EXEC_OPTS, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}
