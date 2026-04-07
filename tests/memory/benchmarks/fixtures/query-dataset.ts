// ── Benchmark Queries with Ground Truth ──────────────────────
// Each query maps to expected memory symbolic names from seed-dataset.ts.
// These are resolved to UUIDs at runtime via the IdMap.

export interface BenchmarkQuery {
  readonly query: string;
  readonly expectedNames: readonly string[];
  readonly type?: 'working' | 'episodic' | 'semantic' | 'procedural' | 'pattern';
  readonly description: string;
}

export const BENCHMARK_QUERIES: readonly BenchmarkQuery[] = [
  // ── Auth cluster queries ──
  {
    query: 'JWT authentication',
    expectedNames: ['auth-jwt-setup', 'auth-jwt-validation', 'auth-token-refresh'],
    description: 'Core auth keyword match with synonym expansion',
  },
  {
    query: 'token refresh flow',
    expectedNames: ['auth-token-refresh', 'auth-jwt-setup'],
    description: 'Specific procedural lookup',
  },
  {
    query: 'OAuth bug',
    expectedNames: ['auth-oauth-bug'],
    description: 'Incident lookup',
  },
  {
    query: 'password security',
    expectedNames: ['auth-password-hash', 'auth-rate-limit'],
    description: 'Security-related auth memories',
  },
  {
    query: 'login rate limiting',
    expectedNames: ['auth-rate-limit', 'api-rate-limit-bug'],
    description: 'Cross-cluster: auth + API rate limiting (synonym: login → auth)',
  },

  // ── Database cluster queries ──
  {
    query: 'database migration',
    expectedNames: ['db-migration-guide', 'db-schema-v2'],
    description: 'DB migration with synonym expansion (db → database)',
  },
  {
    query: 'query performance optimization',
    expectedNames: ['db-index-perf', 'db-query-optimize'],
    description: 'Performance pattern matching',
  },
  {
    query: 'database backup',
    expectedNames: ['db-backup-strategy'],
    description: 'Specific procedural lookup',
  },
  {
    query: 'SQL deadlock',
    expectedNames: ['db-deadlock-fix', 'db-connection-pool'],
    description: 'Incident with related connection config',
  },
  {
    query: 'connection pool configuration',
    expectedNames: ['db-connection-pool'],
    description: 'Specific config lookup',
  },

  // ── Deploy cluster queries ──
  {
    query: 'deployment checklist',
    expectedNames: ['deploy-guide', 'deploy-ci-pipeline', 'deploy-rollback'],
    description: 'Deploy with synonym expansion (deploy → deployment, release)',
  },
  {
    query: 'rollback procedure',
    expectedNames: ['deploy-rollback', 'deploy-guide'],
    description: 'Emergency ops procedure',
  },
  {
    query: 'Docker build optimization',
    expectedNames: ['deploy-docker-cache'],
    description: 'Docker-specific pattern',
  },
  {
    query: 'CI pipeline stages',
    expectedNames: ['deploy-ci-pipeline', 'test-ci-parallel'],
    description: 'Cross-cluster: deploy + testing CI',
  },
  {
    query: 'environment variables configuration',
    expectedNames: ['deploy-env-vars'],
    description: 'Config management lookup (synonym: config → configuration)',
  },

  // ── Testing cluster queries ──
  {
    query: 'testing strategy',
    expectedNames: ['test-strategy', 'test-perf-baseline'],
    description: 'High-level testing approach (synonym: test → testing)',
  },
  {
    query: 'mock API pattern',
    expectedNames: ['test-mock-pattern'],
    description: 'Specific testing pattern',
  },
  {
    query: 'flaky test',
    expectedNames: ['test-flaky-fix'],
    description: 'Incident/fix lookup',
  },
  {
    query: 'snapshot testing',
    expectedNames: ['test-snapshot-guide'],
    description: 'Specific procedural guide',
  },
  {
    query: 'performance baseline',
    expectedNames: ['test-perf-baseline', 'api-cache-pattern'],
    description: 'Cross-cluster: testing + API performance',
  },

  // ── API cluster queries ──
  {
    query: 'API versioning',
    expectedNames: ['api-versioning', 'api-error-format'],
    description: 'API convention with synonym expansion (api → endpoint)',
  },
  {
    query: 'cursor pagination',
    expectedNames: ['api-pagination'],
    description: 'Specific implementation guide',
  },
  {
    query: 'webhook retry',
    expectedNames: ['api-webhook-retry'],
    description: 'Specific procedural lookup',
  },
  {
    query: 'REST vs GraphQL',
    expectedNames: ['api-graphql-decision'],
    description: 'Architecture decision lookup',
  },
  {
    query: 'HTTP caching',
    expectedNames: ['api-cache-pattern'],
    description: 'Caching strategy pattern',
  },

  // ── Error cluster queries ──
  {
    query: 'error handling',
    expectedNames: ['error-handling-strategy', 'error-boundary-pattern', 'error-monitoring'],
    description: 'Broad error topic with synonym expansion (error → exception, crash)',
  },
  {
    query: 'circuit breaker',
    expectedNames: ['error-retry-circuit', 'error-graceful-degradation'],
    description: 'Resilience pattern lookup',
  },
  {
    query: 'structured logging',
    expectedNames: ['error-structured-logging', 'error-monitoring'],
    description: 'Logging/monitoring related',
  },
  {
    query: 'memory leak debugging',
    expectedNames: ['error-memory-leak', 'deploy-canary-failure'],
    description: 'Cross-cluster: error + deploy memory issues',
  },
  {
    query: 'graceful degradation',
    expectedNames: ['error-graceful-degradation', 'error-retry-circuit'],
    description: 'Resilience strategy',
  },
];
