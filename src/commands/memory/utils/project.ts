import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

/**
 * Detect the current project name from the working directory.
 * Resolution order:
 *   1. package.json "name" field
 *   2. Directory basename
 *
 * Returns null if detection fails (shouldn't happen in practice).
 */
export function detectProject(cwd: string): string | null {
  // Try package.json name
  const pkgPath = join(cwd, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const raw = readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw) as { name?: string };
      if (pkg.name && typeof pkg.name === 'string') {
        return pkg.name;
      }
    } catch { /* fall through */ }
  }

  // Fall back to directory name
  const dirName = basename(cwd);
  return dirName || null;
}
