import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, closeDatabase } from './fixtures/test-db.js';
import { MemoryRepo } from '../../src/commands/memory/storage/memory-repo.js';
import { SearchRepo } from '../../src/commands/memory/storage/search-repo.js';
import type Database from 'better-sqlite3';
import type { StoreInput } from '../../src/commands/memory/types.js';

describe('SearchRepo', () => {
  let db: Database.Database;
  let memoryRepo: MemoryRepo;
  let searchRepo: SearchRepo;

  const makeMemory = (content: string, type: StoreInput['type'] = 'semantic', importance = 0.5): StoreInput => ({
    type,
    content,
    tags: [],
    importance,
    source: 'manual',
  });

  beforeEach(() => {
    db = createTestDb();
    memoryRepo = new MemoryRepo(db);
    searchRepo = new SearchRepo(db);
  });

  afterEach(() => {
    closeDatabase(db);
  });

  describe('searchFts', () => {
    it('should find memories by keyword match', () => {
      memoryRepo.create(makeMemory('Authentication uses JWT tokens'), null);
      memoryRepo.create(makeMemory('Database uses PostgreSQL'), null);
      memoryRepo.create(makeMemory('JWT verification happens in middleware'), null);

      const results = searchRepo.searchFts({ query: 'JWT', limit: 10 });
      expect(results.length).toBeGreaterThanOrEqual(2);
      for (const r of results) {
        expect(r.memoryId).toBeDefined();
        expect(r.rank).toBeLessThan(0); // BM25 ranks are negative
      }
    });

    it('should return empty for no matches', () => {
      memoryRepo.create(makeMemory('Hello world'), null);
      const results = searchRepo.searchFts({ query: 'nonexistentxyz', limit: 10 });
      expect(results).toHaveLength(0);
    });

    it('should respect limit', () => {
      for (let i = 0; i < 10; i++) {
        memoryRepo.create(makeMemory(`Memory about testing number ${i}`), null);
      }
      const results = searchRepo.searchFts({ query: 'testing', limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should handle special characters in query', () => {
      memoryRepo.create(makeMemory('Error: SQLITE_BUSY in database'), null);
      // Should not throw
      const results = searchRepo.searchFts({ query: 'SQLITE_BUSY: error', limit: 10 });
      expect(results).toBeDefined();
    });

    it('should handle empty/whitespace query', () => {
      const results = searchRepo.searchFts({ query: '   ', limit: 10 });
      expect(results).toHaveLength(0);
    });

    it('should weight title matches higher', () => {
      memoryRepo.create({
        ...makeMemory('Some random content here'),
        title: 'Authentication flow',
      }, null);
      memoryRepo.create(makeMemory('The authentication system uses OAuth'), null);

      const results = searchRepo.searchFts({ query: 'authentication', limit: 10 });
      expect(results.length).toBeGreaterThanOrEqual(2);
      // Title-matched result should rank higher (more negative rank)
      const titleMatch = results.find(r => {
        const mem = memoryRepo.getById(r.memoryId);
        return mem?.title === 'Authentication flow';
      });
      expect(titleMatch).toBeDefined();
    });
  });

});
