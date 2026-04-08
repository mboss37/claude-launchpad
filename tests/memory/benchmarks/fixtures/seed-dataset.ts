import type { MemoryRepo } from '../../../../src/commands/memory/storage/memory-repo.js';
import type { RelationRepo } from '../../../../src/commands/memory/storage/relation-repo.js';
import type { StoreInput, MemoryType } from '../../../../src/commands/memory/types.js';
import { daysAgoIso } from './bench-harness.js';

// ── Symbolic Name → UUID Map ─────────────────────────────────

export type IdMap = Map<string, string>;

// ── Seed Entry ───────────────────────────────────────────────

interface SeedEntry {
  readonly name: string;
  readonly input: StoreInput;
  readonly daysAgo?: number;
  readonly accessCount?: number;
  readonly injectionCount?: number;
}

// ── Topic Clusters ───────────────────────────────────────────
// 6 clusters × ~13 memories = ~78 memories across all 5 types

const AUTH_CLUSTER: readonly SeedEntry[] = [
  { name: 'auth-jwt-setup', input: { type: 'procedural', content: 'To set up JWT authentication: install jsonwebtoken, create a signing key, implement middleware that verifies tokens on protected routes. Use RS256 for production.', title: 'JWT authentication setup guide', tags: ['auth', 'jwt', 'howto'], importance: 0.8, source: 'manual' } },
  { name: 'auth-jwt-validation', input: { type: 'semantic', content: 'JWT tokens must be validated on every request. Check expiry, issuer, and audience claims. Never trust client-side token parsing alone.', title: 'JWT validation rules', tags: ['auth', 'jwt', 'security'], importance: 0.9, source: 'manual' } },
  { name: 'auth-token-refresh', input: { type: 'procedural', content: 'Token refresh flow: client sends expired access token + refresh token. Server validates refresh token, issues new access token. Refresh tokens are single-use and stored in database.', title: 'Token refresh implementation', tags: ['auth', 'jwt'], importance: 0.7, source: 'manual' } },
  { name: 'auth-oauth-bug', input: { type: 'episodic', content: 'Found a bug where OAuth callback URL was not URL-encoded, causing redirect failures on Safari. Fixed by encoding the callback parameter.', title: 'OAuth callback encoding bug', tags: ['auth', 'bug'], importance: 0.5, source: 'manual' }, daysAgo: 14 },
  { name: 'auth-session-pattern', input: { type: 'pattern', content: 'Session-based auth fails silently when cookies are blocked. Pattern: always implement a fallback detection mechanism that warns users about disabled cookies.', title: 'Session auth cookie detection pattern', tags: ['auth', 'pattern'], importance: 0.6, source: 'manual' } },
  { name: 'auth-rate-limit', input: { type: 'semantic', content: 'Rate limiting on login endpoints prevents brute force attacks. Use exponential backoff: 1s, 2s, 4s, 8s delays after failed attempts. Lock account after 10 failures.', title: 'Login rate limiting strategy', tags: ['auth', 'security'], importance: 0.8, source: 'manual' } },
  { name: 'auth-password-hash', input: { type: 'semantic', content: 'Always use bcrypt or argon2 for password hashing. Never use MD5 or SHA-256 for passwords. Cost factor of 12 is recommended for bcrypt.', title: 'Password hashing standards', tags: ['auth', 'security'], importance: 0.9, source: 'manual' }, daysAgo: 60 },
];

const DB_CLUSTER: readonly SeedEntry[] = [
  { name: 'db-migration-guide', input: { type: 'procedural', content: 'Database migration workflow: create migration file, write up/down SQL, test locally, run in staging, then production. Always backup before production migrations.', title: 'Database migration workflow', tags: ['database', 'migration', 'howto'], importance: 0.8, source: 'manual' } },
  { name: 'db-schema-v2', input: { type: 'semantic', content: 'Schema v2 adds a users_preferences table with JSON column for flexible settings. Foreign key to users table. Indexed on user_id for fast lookups.', title: 'Schema v2 design decisions', tags: ['database', 'schema'], importance: 0.7, source: 'manual' }, daysAgo: 30 },
  { name: 'db-index-perf', input: { type: 'pattern', content: 'Adding a composite index on (user_id, created_at) reduced query time from 800ms to 12ms on the activity feed. Pattern: always profile before and after index changes.', title: 'Index performance pattern', tags: ['database', 'performance'], importance: 0.7, source: 'manual' }, accessCount: 8 },
  { name: 'db-connection-pool', input: { type: 'semantic', content: 'Connection pool configuration: min 5, max 20, idle timeout 30s, connection timeout 5s. Monitor pool exhaustion with pg_stat_activity.', title: 'Connection pool settings', tags: ['database', 'config'], importance: 0.6, source: 'manual' } },
  { name: 'db-deadlock-fix', input: { type: 'episodic', content: 'Production deadlock on orders table caused by concurrent updates without consistent lock ordering. Fixed by always acquiring locks in order: users → orders → line_items.', title: 'Production deadlock incident', tags: ['database', 'bug', 'incident'], importance: 0.8, source: 'manual' }, daysAgo: 45 },
  { name: 'db-backup-strategy', input: { type: 'procedural', content: 'Backup strategy: WAL-mode continuous archiving + daily pg_dump snapshots. Keep 30 days of WAL, 7 daily snapshots. Test restore monthly.', title: 'Database backup strategy', tags: ['database', 'ops'], importance: 0.9, source: 'manual' } },
  { name: 'db-query-optimize', input: { type: 'pattern', content: 'N+1 query pattern detected in user dashboard. Solved with eager loading via JOIN instead of lazy loading in a loop. Reduced queries from 150 to 3.', title: 'N+1 query optimization', tags: ['database', 'performance', 'pattern'], importance: 0.7, source: 'manual' }, daysAgo: 20 },
];

const DEPLOY_CLUSTER: readonly SeedEntry[] = [
  { name: 'deploy-guide', input: { type: 'procedural', content: 'Deployment checklist: run tests, build artifacts, push Docker image, update Kubernetes manifests, apply with kubectl, verify health checks, monitor for 15 minutes.', title: 'Deployment checklist', tags: ['deploy', 'ops', 'howto'], importance: 0.9, source: 'manual' } },
  { name: 'deploy-ci-pipeline', input: { type: 'semantic', content: 'CI pipeline stages: lint → typecheck → test → build → push image → deploy staging → smoke test → deploy production. Each stage gates the next.', title: 'CI/CD pipeline architecture', tags: ['deploy', 'ci'], importance: 0.8, source: 'manual' } },
  { name: 'deploy-rollback', input: { type: 'procedural', content: 'Rollback procedure: kubectl rollout undo deployment/app, verify pods healthy, check database compatibility (migrations may not be reversible), notify team in Slack.', title: 'Rollback procedure', tags: ['deploy', 'ops'], importance: 0.9, source: 'manual' }, accessCount: 5 },
  { name: 'deploy-canary-failure', input: { type: 'episodic', content: 'Canary deployment caught a memory leak in v2.3.1 that only manifested after 4 hours under load. Canary was at 5% traffic. Rolled back before it hit production.', title: 'Canary caught memory leak', tags: ['deploy', 'incident'], importance: 0.6, source: 'manual' }, daysAgo: 35 },
  { name: 'deploy-docker-cache', input: { type: 'pattern', content: 'Docker build times cut from 8 min to 90 seconds by reordering Dockerfile layers. Pattern: copy package.json first, install deps, then copy source. Deps layer is cached.', title: 'Docker layer caching pattern', tags: ['deploy', 'docker', 'performance'], importance: 0.7, source: 'manual' } },
  { name: 'deploy-env-vars', input: { type: 'semantic', content: 'Environment variables are injected via Kubernetes ConfigMaps and Secrets. Never bake env vars into Docker images. Separate config from code per 12-factor app methodology.', title: 'Environment variable management', tags: ['deploy', 'config'], importance: 0.7, source: 'manual' }, daysAgo: 90 },
];

const TESTING_CLUSTER: readonly SeedEntry[] = [
  { name: 'test-strategy', input: { type: 'semantic', content: 'Testing strategy: unit tests for pure functions, integration tests for database operations, E2E tests for critical user flows. Target 80% coverage on business logic.', title: 'Testing strategy', tags: ['testing', 'convention'], importance: 0.8, source: 'manual' } },
  { name: 'test-mock-pattern', input: { type: 'pattern', content: 'Mocking external APIs: use msw (Mock Service Worker) for HTTP mocking in tests. Define handlers per test suite. Reset between tests. Never mock what you own.', title: 'API mocking pattern with msw', tags: ['testing', 'pattern'], importance: 0.6, source: 'manual' } },
  { name: 'test-flaky-fix', input: { type: 'episodic', content: 'Fixed flaky test in checkout flow caused by race condition in async state update. Root cause: test was not awaiting the state transition before asserting.', title: 'Flaky test race condition fix', tags: ['testing', 'bug'], importance: 0.5, source: 'manual' }, daysAgo: 10 },
  { name: 'test-snapshot-guide', input: { type: 'procedural', content: 'Snapshot testing guidelines: use for component output and API response shapes. Update snapshots intentionally (not blindly). Review snapshot diffs in PRs. Keep snapshots small.', title: 'Snapshot testing guidelines', tags: ['testing', 'howto'], importance: 0.5, source: 'manual' } },
  { name: 'test-perf-baseline', input: { type: 'semantic', content: 'Performance test baselines: API response P95 < 200ms, page load < 3s, bundle size < 500KB. Run performance tests nightly, alert on 20% regression.', title: 'Performance test baselines', tags: ['testing', 'performance'], importance: 0.7, source: 'manual' } },
  { name: 'test-ci-parallel', input: { type: 'pattern', content: 'CI test parallelization: split test suites across 4 workers using file-based sharding. Reduced CI time from 12 minutes to 3.5 minutes. Ensure no shared state between shards.', title: 'CI test parallelization pattern', tags: ['testing', 'ci', 'performance'], importance: 0.6, source: 'manual' }, daysAgo: 25 },
];

const API_CLUSTER: readonly SeedEntry[] = [
  { name: 'api-versioning', input: { type: 'semantic', content: 'API versioning via URL prefix (/v1/, /v2/). Never break existing versions. Deprecation policy: announce 6 months ahead, maintain for 12 months after deprecation.', title: 'API versioning policy', tags: ['api', 'convention'], importance: 0.8, source: 'manual' } },
  { name: 'api-pagination', input: { type: 'procedural', content: 'Cursor-based pagination implementation: use encoded (id, created_at) tuple as cursor. Return next_cursor in response. Avoid offset pagination for large datasets.', title: 'Cursor pagination implementation', tags: ['api', 'howto'], importance: 0.7, source: 'manual' } },
  { name: 'api-error-format', input: { type: 'semantic', content: 'API error response format: { error: { code: string, message: string, details?: object } }. Use HTTP status codes correctly. 400 for validation, 401 for auth, 403 for authz, 404 for not found.', title: 'API error response format', tags: ['api', 'convention'], importance: 0.7, source: 'manual' } },
  { name: 'api-rate-limit-bug', input: { type: 'episodic', content: 'Rate limiter was counting OPTIONS preflight requests, causing CORS failures for legitimate users. Fixed by excluding preflight from rate limit counting.', title: 'Rate limiter CORS preflight bug', tags: ['api', 'bug'], importance: 0.5, source: 'manual' }, daysAgo: 7 },
  { name: 'api-graphql-decision', input: { type: 'semantic', content: 'Decision: use REST for public API, GraphQL for internal dashboard. REST is simpler for external consumers. GraphQL flexibility helps rapid dashboard iteration.', title: 'REST vs GraphQL decision', tags: ['api', 'decision'], importance: 0.8, source: 'manual' }, daysAgo: 120 },
  { name: 'api-cache-pattern', input: { type: 'pattern', content: 'HTTP caching pattern: use ETag for mutable resources, Cache-Control max-age for static assets. Stale-while-revalidate for API responses that tolerate brief staleness.', title: 'HTTP caching strategy', tags: ['api', 'performance', 'pattern'], importance: 0.7, source: 'manual' } },
  { name: 'api-webhook-retry', input: { type: 'procedural', content: 'Webhook delivery: retry with exponential backoff (1s, 5s, 30s, 5m, 30m). Store delivery attempts in database. Mark as failed after 5 retries. Provide manual retry UI.', title: 'Webhook retry strategy', tags: ['api', 'howto'], importance: 0.6, source: 'manual' } },
];

const ERROR_CLUSTER: readonly SeedEntry[] = [
  { name: 'error-handling-strategy', input: { type: 'semantic', content: 'Error handling strategy: catch at boundaries (API handlers, message consumers), log with structured context, return user-friendly messages. Never expose stack traces to clients.', title: 'Error handling strategy', tags: ['error', 'convention'], importance: 0.8, source: 'manual' } },
  { name: 'error-monitoring', input: { type: 'procedural', content: 'Error monitoring setup: Sentry for exception tracking, structured logging to Datadog, PagerDuty alerts for error rate spikes. Tag errors with request ID for correlation.', title: 'Error monitoring setup', tags: ['error', 'ops', 'howto'], importance: 0.7, source: 'manual' } },
  { name: 'error-boundary-pattern', input: { type: 'pattern', content: 'React error boundary pattern: wrap feature sections independently. Log errors to monitoring. Show fallback UI per section, not full page crash. Reset state on navigation.', title: 'React error boundary pattern', tags: ['error', 'pattern', 'react'], importance: 0.6, source: 'manual' } },
  { name: 'error-memory-leak', input: { type: 'episodic', content: 'Memory leak in error handler caused by holding references to request objects in error context. Fixed by extracting only necessary fields (method, path, status) before logging.', title: 'Error handler memory leak', tags: ['error', 'bug', 'performance'], importance: 0.6, source: 'manual' }, daysAgo: 50, accessCount: 3 },
  { name: 'error-retry-circuit', input: { type: 'pattern', content: 'Circuit breaker pattern for external service calls: track failure rate over sliding window. Open circuit at 50% failure rate. Half-open after 30s cooldown. Reset on success.', title: 'Circuit breaker pattern', tags: ['error', 'pattern', 'resilience'], importance: 0.8, source: 'manual' }, accessCount: 12 },
  { name: 'error-graceful-degradation', input: { type: 'semantic', content: 'Graceful degradation strategy: identify non-critical features (recommendations, analytics, notifications). Wrap in try-catch with fallback behavior. Core checkout flow must never fail due to optional features.', title: 'Graceful degradation approach', tags: ['error', 'architecture'], importance: 0.7, source: 'manual' }, daysAgo: 40 },
  { name: 'error-structured-logging', input: { type: 'procedural', content: 'Structured logging format: JSON with timestamp, level, message, requestId, userId, service, duration. Use log levels consistently: debug for dev, info for operations, warn for recoverable, error for failures.', title: 'Structured logging guide', tags: ['error', 'ops', 'howto'], importance: 0.6, source: 'manual' } },
];

const ALL_CLUSTERS = [
  ...AUTH_CLUSTER, ...DB_CLUSTER, ...DEPLOY_CLUSTER,
  ...TESTING_CLUSTER, ...API_CLUSTER, ...ERROR_CLUSTER,
];

// ── Relations ────────────────────────────────────────────────

interface SeedRelation {
  readonly source: string;
  readonly target: string;
  readonly type: 'relates_to' | 'depends_on' | 'contradicts' | 'extends' | 'implements' | 'derived_from';
}

const SEED_RELATIONS: readonly SeedRelation[] = [
  { source: 'auth-jwt-setup', target: 'auth-jwt-validation', type: 'extends' },
  { source: 'auth-jwt-validation', target: 'auth-token-refresh', type: 'relates_to' },
  { source: 'auth-rate-limit', target: 'auth-password-hash', type: 'relates_to' },
  { source: 'auth-oauth-bug', target: 'auth-session-pattern', type: 'derived_from' },
  { source: 'db-migration-guide', target: 'db-schema-v2', type: 'relates_to' },
  { source: 'db-index-perf', target: 'db-query-optimize', type: 'relates_to' },
  { source: 'db-deadlock-fix', target: 'db-connection-pool', type: 'relates_to' },
  { source: 'deploy-guide', target: 'deploy-rollback', type: 'extends' },
  { source: 'deploy-ci-pipeline', target: 'test-ci-parallel', type: 'depends_on' },
  { source: 'deploy-docker-cache', target: 'deploy-ci-pipeline', type: 'relates_to' },
  { source: 'api-versioning', target: 'api-error-format', type: 'relates_to' },
  { source: 'api-pagination', target: 'db-query-optimize', type: 'depends_on' },
  { source: 'api-cache-pattern', target: 'test-perf-baseline', type: 'relates_to' },
  { source: 'error-handling-strategy', target: 'error-monitoring', type: 'extends' },
  { source: 'error-retry-circuit', target: 'error-graceful-degradation', type: 'relates_to' },
  { source: 'error-boundary-pattern', target: 'error-handling-strategy', type: 'implements' },
  { source: 'error-memory-leak', target: 'error-structured-logging', type: 'derived_from' },
  { source: 'auth-rate-limit', target: 'api-rate-limit-bug', type: 'relates_to' },
  { source: 'db-backup-strategy', target: 'deploy-rollback', type: 'relates_to' },
  { source: 'test-strategy', target: 'test-perf-baseline', type: 'extends' },
];

// ── Seed Functions ───────────────────────────────────────────

export function seedDatabase(memoryRepo: MemoryRepo): IdMap {
  const idMap: IdMap = new Map();

  for (const entry of ALL_CLUSTERS) {
    const memory = memoryRepo.create(entry.input, null)!;
    idMap.set(entry.name, memory.id);

    // Backdate if specified
    if (entry.daysAgo) {
      const date = daysAgoIso(entry.daysAgo);
      memoryRepo.db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?').run(date, date, memory.id);
    }

    // Set access count
    if (entry.accessCount) {
      for (let i = 0; i < entry.accessCount; i++) {
        memoryRepo.incrementAccess(memory.id);
      }
    }

    // Set injection count
    if (entry.injectionCount) {
      for (let i = 0; i < entry.injectionCount; i++) {
        memoryRepo.incrementInjection(memory.id);
      }
    }
  }

  return idMap;
}

export function seedRelations(relationRepo: RelationRepo, idMap: IdMap): number {
  let created = 0;
  for (const rel of SEED_RELATIONS) {
    const sourceId = idMap.get(rel.source);
    const targetId = idMap.get(rel.target);
    if (sourceId && targetId) {
      relationRepo.create(sourceId, targetId, rel.type);
      created++;
    }
  }
  return created;
}

export const SEED_COUNT = ALL_CLUSTERS.length;

// ── Bulk Seeder (for scale tests) ────────────────────────────

export function seedBulk(memoryRepo: MemoryRepo, count: number): void {
  const types: MemoryType[] = ['episodic', 'semantic', 'procedural', 'pattern'];
  const topics = ['auth', 'database', 'deploy', 'testing', 'api', 'error', 'cache', 'queue', 'search', 'logging'];

  const insertMany = memoryRepo.db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const type = types[i % types.length]!;
      const topic = topics[i % topics.length]!;
      const importance = 0.1 + Math.random() * 0.9;
      const daysOld = Math.floor(Math.random() * 365);

      const memory = memoryRepo.create({
        type,
        content: `Memory about ${topic} topic number ${i}. This contains information about ${topic} systems, patterns, and best practices for building reliable software.`,
        title: `${topic} memory #${i}`,
        tags: [topic, type],
        importance,
        source: 'manual',
      }, null)!;

      const date = daysAgoIso(daysOld);
      memoryRepo.db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?').run(date, date, memory.id);
    }
  });

  insertMany();
}
