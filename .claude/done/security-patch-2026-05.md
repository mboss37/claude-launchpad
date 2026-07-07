# SECURITY-PATCH — 2026-05-20

> **Agent: execute this brief end-to-end. Follow `.claude/rules/conventions.md` for the commit (conventional commits, TDD where required). This package is published to npm — your transitives become your users' transitives. Patch is high-priority.**

## Why
This package ships to npm. Every CVE that survives in lockfile becomes a CVE in every downstream user's `node_modules`. Audit on 2026-05-20: **20 vulnerabilities (4 high, 15 moderate, 1 low)**. None are active worm infections. Patch the highs now, plan the moderates.

## Baseline (verify before changes)
```bash
cd ~/projects/claude-launchpad
pnpm audit --audit-level=high
```
Expected starting state: **4 high** total. Two are direct deps (Next.js for the docs site, Anthropic SDK), one is transitive (fast-uri).

## High-severity fixes

### 1. @anthropic-ai/sdk (HIGH — direct)
- **Advisory**: Insecure default file permissions in local-filesystem Memory tool
- **Vulnerable**: `>=0.79.0 <0.91.1`
- **Patched**: `>=0.91.1`
- **Fix**:
  ```bash
  pnpm add @anthropic-ai/sdk@latest
  ```

### 2. next (HIGH — direct in docs workspace)
- **Advisory**: DoS with Server Components
- **Vulnerable**: `>=16.0.0 <16.2.5`
- **Patched**: `>=16.2.5`
- **Path**: `docs > next`
- **Fix**:
  ```bash
  cd docs && pnpm add next@latest && cd ..
  ```

### 3. fast-uri (HIGH — transitive)
- **Advisory**: GHSA — path traversal via percent-encoded dot segments
- **Vulnerable**: `<=3.1.0`
- **Patched**: `>=3.1.1` (use `>=3.1.2` to also catch the host-confusion CVE)
- **Path**: `. > @modelcontextprotocol/sdk > ajv > fast-uri`
- **Fix**: add to root `package.json`:
  ```json
  "pnpm": {
    "overrides": {
      "fast-uri": ">=3.1.2"
    }
  }
  ```
  Then `pnpm install`.

## Apply
```bash
# Direct upgrades
pnpm add @anthropic-ai/sdk@latest
cd docs && pnpm add next@latest && cd ..

# Add overrides to root package.json (manual edit)
# Re-install
pnpm install

# Pre-commit checklist (per .claude/rules/conventions.md)
pnpm typecheck
pnpm test:run
pnpm test:regression  # if memory not touched, optional
```

## Verify
```bash
pnpm audit --audit-level=high
# Expected: 0 high
```

## Rollback
```bash
git restore package.json docs/package.json pnpm-lock.yaml
pnpm install
```

## Done when
- [ ] `pnpm audit --audit-level=high` returns 0 high
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test:run` passes (no regressions in 442+ test suite)
- [ ] Commit per project convention: `chore(sec): patch CVEs (@anthropic-ai/sdk, next, fast-uri)`
- [ ] Per release plan in `TASKS.md`: this is a non-src dep update, so commit normally — NO version bump, NO release publish
- [ ] Delete this file or move to `.claude/done/security-patch-2026-05.md`

## Hard rules during patch
- DO NOT use `pnpm audit fix --force`
- DO NOT bump version in `package.json` or `src/cli.ts` for this commit (deps-only change, per release-plumbing rules)
- DO NOT skip pre-commit checklist (`pnpm typecheck && pnpm test:run`)
- Lockfile (`pnpm-lock.yaml`) MUST be committed

## Moderate-severity backlog
- `brace-expansion` >=5.0.0 <5.0.6
- `hono` <4.12.18, `@hono/node-server` <1.19.13
- `ip-address` <=10.1.0
- `postcss` <8.5.10
- `ws` >=8.0.0 <8.20.1

Add these as a P2 work package in `BACKLOG.md` if not patched in-sprint.
