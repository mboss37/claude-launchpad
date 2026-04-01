import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MemoryRepo } from '../storage/memory-repo.js';
import type { RelationRepo } from '../storage/relation-repo.js';
import type { RetrievalService } from '../services/retrieval-service.js';
import { registerStore } from './store.js';
import { registerSearch } from './search.js';
import { registerForget } from './forget.js';
import { registerRelate } from './relate.js';
import { registerStats } from './stats.js';
import { registerRecent } from './recent.js';
import { registerUpdate } from './update.js';

export interface ToolDeps {
  readonly memoryRepo: MemoryRepo;
  readonly relationRepo: RelationRepo;
  readonly retrievalService: RetrievalService;
  readonly dataDir: string;
  readonly project: string | null;
}

export function registerTools(server: McpServer, deps: ToolDeps): void {
  registerStore(server, deps);
  registerSearch(server, deps);
  registerRecent(server, deps);
  registerForget(server, deps);
  registerRelate(server, deps);
  registerStats(server, deps);
  registerUpdate(server, deps);
}
