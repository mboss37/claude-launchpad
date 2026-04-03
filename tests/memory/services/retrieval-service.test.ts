import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, closeDatabase } from '../fixtures/test-db.js';
import { MemoryRepo } from '../../../src/commands/memory/storage/memory-repo.js';
import { RelationRepo } from '../../../src/commands/memory/storage/relation-repo.js';
import { SearchRepo } from '../../../src/commands/memory/storage/search-repo.js';
import { RetrievalService, computeRecencyScore, computeAccessScore, ftsOnlyScores } from '../../../src/commands/memory/services/retrieval-service.js';
import type Database from 'better-sqlite3';
import type { StoreInput } from '../../../src/commands/memory/types.js';

describe('RetrievalService', () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepo;
  let relationRepo: RelationRepo;
  let searchRepo: SearchRepo;
  let service: RetrievalService;

  const makeMemory = (content: string, type: StoreInput['type'] = 'semantic', importance = 0.5): ReturnType<MemoryRepo['create']> => {
    return memoryRepo.create(
      { type, content, tags: [], importance, source: 'manual' },
      null,
    );
  };

  beforeEach(() => {
    db = createTestDb();
    memoryRepo = new MemoryRepo(db);
    relationRepo = new RelationRepo(db);
    searchRepo = new SearchRepo(db);
    service = new RetrievalService({ memoryRepo, relationRepo, searchRepo });
  });

  afterEach(() => {
    closeDatabase(db);
  });

  describe('search', () => {
    it('should return results for keyword matches', async () => {
      makeMemory('Authentication uses JWT tokens');
      makeMemory('Database schema design patterns');
      makeMemory('JWT token refresh implementation');

      const results = await service.search({
        query: 'JWT authentication',
        limit: 10,
        min_importance: 0,
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      for (const r of results) {
        expect(r.score).toBeGreaterThan(0);
        expect(r.explanation).toBeDefined();
      }
    });

    it('should return results sorted by composite score (descending)', async () => {
      makeMemory('Quick note about testing', 'episodic', 0.3);
      makeMemory('Critical authentication vulnerability fix', 'semantic', 0.9);
      makeMemory('Authentication middleware setup guide', 'procedural', 0.7);

      const results = await service.search({
        query: 'authentication',
        limit: 10,
        min_importance: 0,
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
      }
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        makeMemory(`Memory about testing topic ${i}`);
      }

      const results = await service.search({
        query: 'testing topic',
        limit: 3,
        min_importance: 0,
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should filter by type when specified', async () => {
      makeMemory('Semantic fact about auth', 'semantic');
      makeMemory('Episodic event about auth', 'episodic');

      const results = await service.search({
        query: 'auth',
        limit: 10,
        type: 'semantic',
        min_importance: 0,
      });

      for (const r of results) {
        expect(r.memory.type).toBe('semantic');
      }
    });

    it('should filter by minimum importance', async () => {
      makeMemory('Low importance note', 'semantic', 0.2);
      makeMemory('High importance fact', 'semantic', 0.8);

      const results = await service.search({
        query: 'importance',
        limit: 10,
        min_importance: 0.5,
      });

      for (const r of results) {
        expect(r.memory.importance).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should filter by tags when specified', async () => {
      memoryRepo.create(
        { type: 'semantic', content: 'Auth bug in login flow', tags: ['bug', 'auth'], importance: 0.5, source: 'manual' },
        null,
      );
      memoryRepo.create(
        { type: 'semantic', content: 'Auth decision about tokens', tags: ['decision', 'auth'], importance: 0.5, source: 'manual' },
        null,
      );

      const results = await service.search({
        query: 'auth',
        tags: ['bug'],
        limit: 10,
        min_importance: 0,
      });

      expect(results.length).toBe(1);
      expect(results[0]!.memory.tags).toContain('bug');
    });

    it('should require ALL tags when filtering', async () => {
      memoryRepo.create(
        { type: 'semantic', content: 'Auth bug tagged both', tags: ['bug', 'auth'], importance: 0.5, source: 'manual' },
        null,
      );
      memoryRepo.create(
        { type: 'semantic', content: 'Auth decision only', tags: ['auth'], importance: 0.5, source: 'manual' },
        null,
      );

      const results = await service.search({
        query: 'auth',
        tags: ['bug', 'auth'],
        limit: 10,
        min_importance: 0,
      });

      expect(results.length).toBe(1);
      expect(results[0]!.memory.content).toContain('tagged both');
    });

    it('should do direct ID lookup when id is provided', async () => {
      const created = makeMemory('Specific memory for lookup');

      const results = await service.search({
        query: 'irrelevant',
        id: created.id,
        limit: 10,
        min_importance: 0,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.memory.id).toBe(created.id);
      expect(results[0]!.score).toBe(1.0);
      expect(results[0]!.explanation).toBe('Direct lookup by ID');
    });

    it('should return empty array for non-existent ID', async () => {
      const results = await service.search({
        query: 'x',
        id: 'nonexistent',
        limit: 10,
        min_importance: 0,
      });

      expect(results).toHaveLength(0);
    });

    it('should include staleness warning for old episodic memories', async () => {
      const created = makeMemory('Old episodic event happened', 'episodic', 0.5);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
      db.prepare('UPDATE memories SET created_at = ? WHERE id = ?').run(thirtyDaysAgo, created.id);

      const results = await service.search({
        query: 'episodic event',
        limit: 10,
        min_importance: 0,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.explanation).toContain('verify before acting');
      expect(results[0]!.explanation).toContain('30d old');
    });

    it('should not include staleness warning for fresh memories', async () => {
      makeMemory('Fresh semantic fact', 'semantic', 0.5);

      const results = await service.search({
        query: 'fresh semantic',
        limit: 10,
        min_importance: 0,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.explanation).not.toContain('verify before acting');
    });

    it('should increment access count on search results', async () => {
      const created = makeMemory('Memory that gets accessed');

      await service.search({
        query: 'accessed',
        limit: 10,
        min_importance: 0,
      });

      const updated = memoryRepo.getById(created.id);
      expect(updated!.accessCount).toBeGreaterThan(0);
    });

  });
});

describe('relation-boosted search', () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepo;
  let relationRepo: RelationRepo;
  let searchRepo: SearchRepo;
  let service: RetrievalService;

  beforeEach(() => {
    db = createTestDb();
    memoryRepo = new MemoryRepo(db);
    relationRepo = new RelationRepo(db);
    searchRepo = new SearchRepo(db);
    service = new RetrievalService({ memoryRepo, relationRepo, searchRepo });
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('should surface related memories that do not match the query', async () => {
    const memA = memoryRepo.create(
      { type: 'semantic', content: 'Authentication uses JWT tokens', tags: [], importance: 0.7, source: 'manual' },
      null,
    );

    const memB = memoryRepo.create(
      { type: 'procedural', content: 'Session expiry is configured to fifteen minutes', tags: [], importance: 0.6, source: 'manual' },
      null,
    );

    relationRepo.create(memA.id, memB.id, 'depends_on');

    const results = await service.search({ query: 'JWT authentication', limit: 10, min_importance: 0 });

    const ids = results.map(r => r.memory.id);
    expect(ids).toContain(memB.id);

    const scoreA = results.find(r => r.memory.id === memA.id)!.score;
    const scoreB = results.find(r => r.memory.id === memB.id)!.score;
    expect(scoreA).toBeGreaterThan(scoreB);

    const explB = results.find(r => r.memory.id === memB.id)!.explanation;
    expect(explB).toContain('Related');
    expect(explB).toContain('depends_on');
  });

  it('should not expand when results already fill the limit', async () => {
    for (let i = 0; i < 3; i++) {
      const mem = memoryRepo.create(
        { type: 'semantic', content: `auth related topic ${i}`, tags: [], importance: 0.5, source: 'manual' },
        null,
      );
      const related = memoryRepo.create(
        { type: 'semantic', content: `completely unrelated ${i}`, tags: [], importance: 0.5, source: 'manual' },
        null,
      );
      relationRepo.create(mem.id, related.id, 'relates_to');
    }

    const results = await service.search({ query: 'auth related topic', limit: 3, min_importance: 0 });

    expect(results.length).toBeLessThanOrEqual(3);
    for (const r of results) {
      expect(r.explanation).not.toContain('Related');
    }
  });

  it('should not duplicate memories that match FTS AND are related', async () => {
    const memA = memoryRepo.create(
      { type: 'semantic', content: 'JWT token validation', tags: [], importance: 0.7, source: 'manual' },
      null,
    );

    const memB = memoryRepo.create(
      { type: 'semantic', content: 'JWT token refresh logic', tags: [], importance: 0.6, source: 'manual' },
      null,
    );

    relationRepo.create(memA.id, memB.id, 'extends');

    const results = await service.search({ query: 'JWT token', limit: 10, min_importance: 0 });

    const bResults = results.filter(r => r.memory.id === memB.id);
    expect(bResults).toHaveLength(1);
  });
});

describe('context-aware search', () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepo;
  let relationRepo: RelationRepo;
  let searchRepo: SearchRepo;

  beforeEach(() => {
    db = createTestDb();
    memoryRepo = new MemoryRepo(db);
    relationRepo = new RelationRepo(db);
    searchRepo = new SearchRepo(db);
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('should rank memories with matching context higher', async () => {
    const gitContext = { branch: 'feature/auth', recentFiles: ['src/auth.ts'] };
    const service = new RetrievalService({ memoryRepo, relationRepo, searchRepo, gitContext });

    memoryRepo.create(
      {
        type: 'semantic', content: 'Auth token validation logic', tags: [], importance: 0.5, source: 'manual',
        context: JSON.stringify({ branch: 'feature/auth', files: ['src/auth.ts'] }),
      },
      null,
    );

    memoryRepo.create(
      { type: 'semantic', content: 'Auth middleware configuration', tags: [], importance: 0.5, source: 'manual' },
      null,
    );

    const results = await service.search({ query: 'auth', limit: 10, min_importance: 0 });
    expect(results.length).toBe(2);
    expect(results[0]!.memory.context).toBeTruthy();
  });
});

describe('loadSessionContext', () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepo;
  let relationRepo: RelationRepo;
  let searchRepo: SearchRepo;

  beforeEach(() => {
    db = createTestDb();
    memoryRepo = new MemoryRepo(db);
    relationRepo = new RelationRepo(db);
    searchRepo = new SearchRepo(db);
  });

  afterEach(() => {
    closeDatabase(db);
  });

  it('should return context-matched memories when git context matches', () => {
    const gitContext = { branch: 'feature/auth', recentFiles: ['src/auth.ts'] };
    const service = new RetrievalService({ memoryRepo, relationRepo, searchRepo, gitContext });

    memoryRepo.create(
      {
        type: 'semantic', content: 'Auth middleware pattern', tags: [], importance: 0.7, source: 'manual',
        context: JSON.stringify({ branch: 'feature/auth', files: ['src/auth.ts'] }),
      },
      null,
    );

    memoryRepo.create(
      { type: 'semantic', content: 'Database connection pool size', tags: [], importance: 0.5, source: 'manual' },
      null,
    );

    const results = service.loadSessionContext({ limit: 10 });
    const sections = new Set(results.map(r => r.section));

    expect(sections.has('context')).toBe(true);
    expect(sections.has('recent')).toBe(true);

    const contextResults = results.filter(r => r.section === 'context');
    expect(contextResults[0]!.result.memory.content).toContain('Auth middleware');
  });

  it('should include related memories in the related section', () => {
    const service = new RetrievalService({ memoryRepo, relationRepo, searchRepo });

    const memC = memoryRepo.create(
      { type: 'procedural', content: 'How to deploy the service', tags: [], importance: 0.6, source: 'manual' },
      null,
    );
    db.prepare('UPDATE memories SET created_at = ?, updated_at = ? WHERE id = ?')
      .run(new Date(Date.now() - 90 * 86_400_000).toISOString(), new Date(Date.now() - 90 * 86_400_000).toISOString(), memC.id);

    for (let i = 0; i < 10; i++) {
      memoryRepo.create(
        { type: 'semantic', content: `Recent filler memory ${i}`, tags: [], importance: 0.5, source: 'manual' },
        null,
      );
    }

    const memA = memoryRepo.create(
      { type: 'semantic', content: 'Main architecture decision', tags: [], importance: 0.8, source: 'manual' },
      null,
    );

    relationRepo.create(memA.id, memC.id, 'depends_on');

    const results = service.loadSessionContext({ limit: 10 });

    const relatedResults = results.filter(r => r.section === 'related');
    expect(relatedResults.length).toBeGreaterThanOrEqual(1);
    expect(relatedResults.map(r => r.result.memory.id)).toContain(memC.id);
    expect(relatedResults.find(r => r.result.memory.id === memC.id)!.result.explanation).toContain('Related');
  });

  it('should not exceed the limit', () => {
    const service = new RetrievalService({ memoryRepo, relationRepo, searchRepo });

    for (let i = 0; i < 20; i++) {
      memoryRepo.create(
        { type: 'semantic', content: `Memory number ${i}`, tags: [], importance: 0.5, source: 'manual' },
        null,
      );
    }

    const results = service.loadSessionContext({ limit: 5 });
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('should not duplicate memories across sections', () => {
    const gitContext = { branch: 'main', recentFiles: ['src/index.ts'] };
    const service = new RetrievalService({ memoryRepo, relationRepo, searchRepo, gitContext });

    memoryRepo.create(
      {
        type: 'semantic', content: 'Recent and contextual', tags: [], importance: 0.8, source: 'manual',
        context: JSON.stringify({ branch: 'main', files: ['src/index.ts'] }),
      },
      null,
    );

    const results = service.loadSessionContext({ limit: 10 });
    const ids = results.map(r => r.result.memory.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('should increment injection count (not access) on returned memories', () => {
    const service = new RetrievalService({ memoryRepo, relationRepo, searchRepo });
    const mem = memoryRepo.create(
      { type: 'semantic', content: 'Track injection', tags: [], importance: 0.5, source: 'manual' },
      null,
    );

    service.loadSessionContext({ limit: 10 });

    const updated = memoryRepo.getById(mem.id);
    expect(updated!.injectionCount).toBeGreaterThan(0);
    expect(updated!.accessCount).toBe(0);
  });
});

describe('computeRecencyScore', () => {
  it('should return ~1.0 for very recent timestamps', () => {
    const now = new Date().toISOString();
    expect(computeRecencyScore(now)).toBeCloseTo(1.0, 1);
  });

  it('should return ~0.5 at 30 days (half-life)', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(computeRecencyScore(thirtyDaysAgo)).toBeCloseTo(0.5, 1);
  });

  it('should return low score for old timestamps', () => {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(computeRecencyScore(oneYearAgo)).toBeLessThan(0.01);
  });
});

describe('ftsOnlyScores', () => {
  it('should convert FTS BM25 ranks to 0-1 scores', () => {
    const scores = ftsOnlyScores([
      { memoryId: 'a', rank: -10 },
      { memoryId: 'b', rank: -5 },
      { memoryId: 'c', rank: -25 },
    ]);

    expect(scores.get('a')).toBe(0.5);
    expect(scores.get('b')).toBe(0.25);
    expect(scores.get('c')).toBe(1.0);
  });
});

describe('computeAccessScore', () => {
  const now = new Date().toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();

  it('should return 0 for zero access', () => {
    expect(computeAccessScore(0, null)).toBe(0);
  });

  it('should increase with access count', () => {
    const s1 = computeAccessScore(1, now);
    const s5 = computeAccessScore(5, now);
    const s20 = computeAccessScore(20, now);
    expect(s5).toBeGreaterThan(s1);
    expect(s20).toBeGreaterThan(s5);
  });

  it('should cap at 1.0 for high count + recent access', () => {
    expect(computeAccessScore(100, now)).toBeCloseTo(1.0, 1);
    expect(computeAccessScore(1000, now)).toBeCloseTo(1.0, 1);
  });

  it('should score higher for recent access than old access', () => {
    const recent = computeAccessScore(10, now);
    const old = computeAccessScore(10, thirtyDaysAgo);
    expect(recent).toBeGreaterThan(old);
  });

  it('should penalize null lastAccessed to half score', () => {
    const withAccess = computeAccessScore(10, now);
    const withoutAccess = computeAccessScore(10, null);
    expect(withoutAccess).toBeCloseTo(withAccess * 0.5, 1);
  });
});
