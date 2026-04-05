import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { resolveDataDir, DEFAULT_CONFIG } from '../config.js';
import type { SyncConfig } from '../types.js';

const EXEC_OPTS = { encoding: 'utf-8' as const, timeout: 30_000 };
const GIST_FILENAME = 'agentic-memory-sync.json';
const SYNC_CONFIG_FILE = 'sync-config.json';

function syncConfigPath(): string {
  return join(resolveDataDir(DEFAULT_CONFIG.dataDir), SYNC_CONFIG_FILE);
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

export function loadSyncConfig(): SyncConfig | null {
  try {
    const raw = readFileSync(syncConfigPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.gistId === 'string' && parsed.gistId.length > 0) {
      return { gistId: parsed.gistId };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSyncConfig(config: SyncConfig): void {
  const filePath = syncConfigPath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function createGist(payload: string): string {
  const tmpFile = join(tmpdir(), GIST_FILENAME);
  try {
    writeFileSync(tmpFile, payload, 'utf-8');
    const result = execSync(
      `gh gist create "${tmpFile}" --desc "agentic-memory sync" --public=false`,
      { ...EXEC_OPTS, stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    const gistId = result.split('/').pop() ?? '';
    if (!gistId) throw new Error(`Failed to parse gist ID from: ${result}`);
    saveSyncConfig({ gistId });
    return gistId;
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

export function readGist(gistId: string): string | null {
  try {
    return execSync(
      `gh gist view "${gistId}" --filename "${GIST_FILENAME}" --raw`,
      { ...EXEC_OPTS, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } catch {
    return null;
  }
}

export function updateGist(gistId: string, payload: string): void {
  const tmpFile = join(tmpdir(), GIST_FILENAME);
  try {
    writeFileSync(tmpFile, payload, 'utf-8');
    execSync(
      `gh gist edit "${gistId}" --filename "${GIST_FILENAME}" "${tmpFile}"`,
      { ...EXEC_OPTS, stdio: ['pipe', 'pipe', 'pipe'] },
    );
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}
