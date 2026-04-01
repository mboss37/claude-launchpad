import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { DecayParams } from './types.js';

// ── Config Schema ─────────────────────────────────────────────

const ConfigSchema = z.object({
  dataDir: z.string().default('~/.agentic-memory'),
  injectionBudget: z.number().int().min(100).max(20000).default(2000),
  consolidationInterval: z.number().int().min(1).default(10),
  enableReranker: z.boolean().default(true),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('warn'),
});

export type Config = z.infer<typeof ConfigSchema>;

// ── Defaults ──────────────────────────────────────────────────

export const DEFAULT_CONFIG: Config = {
  dataDir: '~/.agentic-memory',
  injectionBudget: 2000,
  consolidationInterval: 10,
  enableReranker: true,
  logLevel: 'warn',
};

export const DEFAULT_DECAY_PARAMS: DecayParams = {
  tauByType: {
    working: 0,       // cleared each session, tau irrelevant
    episodic: 60,     // fast decay
    semantic: 365,    // slow decay
    procedural: 730,  // near-permanent
    pattern: 180,     // medium decay
  },
  accessModifiers: [
    { maxCount: 3, multiplier: 1.0 },
    { maxCount: 10, multiplier: 2.0 },
    { maxCount: Infinity, multiplier: 4.0 },
  ],
  relationModifier: {
    connectedThreshold: 3,
    connectedMultiplier: 0.7,
    isolatedMultiplier: 1.3,
  },
  importanceFloor: 0.05,
  pruneThreshold: 0.1,
  pruneMinAgeDays: 90,
};

export const SCORING_WEIGHTS = {
  text: 0.35,
  importance: 0.20,
  recency: 0.20,
  access: 0.10,
  context: 0.15,
} as const;

// ── Config Loader ─────────────────────────────────────────────

export function resolveDataDir(dataDir: string): string {
  if (dataDir.startsWith('~')) {
    return join(homedir(), dataDir.slice(1));
  }
  return dataDir;
}

export function loadConfig(overrides?: Partial<Config>): Config {
  const envOverrides: Record<string, unknown> = {};

  const envBudget = process.env['AGENTIC_MEMORY_INJECTION_BUDGET'];
  if (envBudget !== undefined) {
    envOverrides['injectionBudget'] = parseInt(envBudget, 10);
  }

  const envLogLevel = process.env['AGENTIC_MEMORY_LOG_LEVEL'];
  if (envLogLevel !== undefined) {
    envOverrides['logLevel'] = envLogLevel;
  }

  const envDataDir = process.env['AGENTIC_MEMORY_DATA_DIR'];
  if (envDataDir !== undefined) {
    envOverrides['dataDir'] = envDataDir;
  }

  // Try loading config.json from data dir
  let fileConfig: Record<string, unknown> = {};
  const baseDir = resolveDataDir(overrides?.dataDir ?? envOverrides['dataDir'] as string ?? DEFAULT_CONFIG.dataDir);
  try {
    const raw = readFileSync(join(baseDir, 'config.json'), 'utf-8');
    fileConfig = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    const isNotFound = err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (!isNotFound) {
      // Malformed JSON or permissions error - warn, don't silently ignore
      console.error('[agentic-memory] Failed to load config.json:', err instanceof Error ? err.message : err);
    }
  }

  const merged = { ...DEFAULT_CONFIG, ...fileConfig, ...envOverrides, ...overrides };
  return ConfigSchema.parse(merged);
}

// ── Token Estimation ──────────────────────────────────────────

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
