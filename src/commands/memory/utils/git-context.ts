import { execSync } from 'node:child_process';

export interface GitContext {
  readonly branch: string | null;
  readonly recentFiles: readonly string[];
}

let cached: GitContext | null = null;

export function getGitContext(): GitContext {
  if (cached) return cached;

  let branch: string | null = null;
  let recentFiles: string[] = [];

  const GIT_OPTS = { encoding: 'utf-8' as const, timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] as ('pipe' | 'ignore' | 'inherit')[] };

  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', GIT_OPTS).trim() || null;
  } catch { /* not in a git repo or git not available */ }

  try {
    const raw = execSync('git diff --name-only HEAD~5', GIT_OPTS).trim();
    recentFiles = raw ? raw.split('\n').filter(Boolean) : [];
  } catch { /* shallow clone or fewer than 5 commits */ }

  cached = { branch, recentFiles };
  return cached;
}

export function clearGitContextCache(): void {
  cached = null;
}

export function computeContextScore(
  storedContext: string | null,
  currentContext: GitContext,
  query: string,
): number {
  if (!storedContext) return 0;

  let parsed: { files?: string[]; branch?: string; intent?: string };
  try {
    parsed = JSON.parse(storedContext) as { files?: string[]; branch?: string; intent?: string };
  } catch {
    return 0;
  }

  // Branch match (weight 0.4)
  const branchScore = (parsed.branch && currentContext.branch && parsed.branch === currentContext.branch) ? 1.0 : 0;

  // File overlap — Jaccard similarity (weight 0.4)
  let fileScore = 0;
  if (parsed.files?.length && currentContext.recentFiles.length) {
    const stored = new Set(parsed.files);
    const current = new Set(currentContext.recentFiles);
    let intersection = 0;
    for (const f of stored) {
      if (current.has(f)) intersection++;
    }
    const union = stored.size + current.size - intersection;
    fileScore = union > 0 ? intersection / union : 0;
  }

  // Intent keyword overlap with query (weight 0.2)
  let intentScore = 0;
  if (parsed.intent && query) {
    const intentWords = new Set(parsed.intent.toLowerCase().split(/\s+/).filter(Boolean));
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter(Boolean));
    let overlap = 0;
    for (const w of intentWords) {
      if (queryWords.has(w)) overlap++;
    }
    const union = intentWords.size + queryWords.size - overlap;
    intentScore = union > 0 ? overlap / union : 0;
  }

  return branchScore * 0.4 + fileScore * 0.4 + intentScore * 0.2;
}
