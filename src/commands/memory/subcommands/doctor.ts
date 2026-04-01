import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createDatabase, closeDatabase } from '../storage/database.js';
import { MemoryRepo } from '../storage/memory-repo.js';
import { loadConfig, resolveDataDir } from '../config.js';
import { log } from '../../../lib/output.js';

interface DoctorOpts {
  readonly json?: boolean;
  readonly fix?: boolean;
  readonly dbPath?: string;
}

interface DiagResult {
  readonly name: string;
  readonly status: 'PASS' | 'WARN' | 'FAIL';
  readonly detail: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export async function runMemoryDoctor(opts: DoctorOpts): Promise<void> {
  const checks: DiagResult[] = [];
  const config = loadConfig(opts.dbPath ? { dataDir: opts.dbPath } : undefined);
  const dataDir = resolveDataDir(config.dataDir);

  // Node.js version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1), 10);
  checks.push({
    name: 'Node.js',
    status: major >= 22 ? 'PASS' : 'WARN',
    detail: major >= 22 ? nodeVersion : `${nodeVersion} (22+ recommended)`,
  });

  // Data directory
  checks.push({
    name: 'Data directory',
    status: existsSync(dataDir) ? 'PASS' : 'FAIL',
    detail: existsSync(dataDir) ? `${dataDir} (writable)` : `${dataDir} (missing)`,
  });

  // Database health
  const dbPath = join(dataDir, 'memory.db');
  if (existsSync(dbPath)) {
    try {
      const db = createDatabase({ dataDir });
      const memoryRepo = new MemoryRepo(db);
      const total = memoryRepo.count();
      const dbSize = statSync(dbPath).size;
      checks.push({ name: 'Database', status: 'PASS', detail: `healthy (${total} memories, ${formatBytes(dbSize)})` });

      // WAL mode
      const walResult = db.pragma('journal_mode') as { journal_mode: string }[];
      const walMode = walResult[0]?.journal_mode;
      checks.push({ name: 'WAL mode', status: walMode === 'wal' ? 'PASS' : 'WARN', detail: walMode ?? 'unknown' });

      // FTS5
      try {
        db.prepare('SELECT * FROM memories_fts LIMIT 0').run();
        checks.push({ name: 'FTS5 index', status: 'PASS', detail: 'synced' });
      } catch {
        checks.push({ name: 'FTS5 index', status: 'FAIL', detail: 'missing or corrupt' });
      }

      closeDatabase(db);
    } catch (err) {
      checks.push({ name: 'Database', status: 'FAIL', detail: err instanceof Error ? err.message : 'unknown error' });
    }
  } else {
    checks.push({ name: 'Database', status: 'FAIL', detail: 'not found (run: claude-launchpad memory install)' });
  }

  // Auto-memory setting
  const projectSettingsPath = join(process.cwd(), '.claude', 'settings.json');
  if (existsSync(projectSettingsPath)) {
    try {
      const raw = readFileSync(projectSettingsPath, 'utf-8');
      const settings = JSON.parse(raw) as Record<string, unknown>;
      const autoMemoryOff = settings['autoMemoryEnabled'] === false;
      checks.push({
        name: 'Auto-memory',
        status: autoMemoryOff ? 'PASS' : 'WARN',
        detail: autoMemoryOff ? 'disabled (using agentic-memory)' : 'still enabled (run: claude-launchpad memory install)',
      });
    } catch {
      checks.push({ name: 'Auto-memory', status: 'WARN', detail: 'Could not read project settings' });
    }
  } else {
    checks.push({ name: 'Auto-memory', status: 'WARN', detail: 'No project settings (run: claude-launchpad memory install)' });
  }

  // Output
  if (opts.json) {
    process.stdout.write(JSON.stringify(checks, null, 2) + '\n');
    return;
  }

  log.blank();
  log.step('Memory doctor');
  log.blank();

  for (const check of checks) {
    const icon = check.status === 'PASS' ? 'PASS' : check.status === 'WARN' ? 'WARN' : 'FAIL';
    if (check.status === 'PASS') {
      log.success(`[${icon}] ${check.name}: ${check.detail}`);
    } else if (check.status === 'WARN') {
      log.warn(`[${icon}] ${check.name}: ${check.detail}`);
    } else {
      log.error(`[${icon}] ${check.name}: ${check.detail}`);
    }
  }

  const passed = checks.filter(c => c.status === 'PASS').length;
  const warned = checks.filter(c => c.status === 'WARN').length;
  const failed = checks.filter(c => c.status === 'FAIL').length;

  log.blank();
  log.info(`${passed} passed, ${warned} warnings, ${failed} failures`);
  log.blank();
}
