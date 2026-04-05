import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createDatabase, closeDatabase } from './storage/database.js';
import { migrate } from './storage/migrator.js';
import { MemoryRepo } from './storage/memory-repo.js';
import { RelationRepo } from './storage/relation-repo.js';
import { SearchRepo } from './storage/search-repo.js';
import { RetrievalService } from './services/retrieval-service.js';
import { loadConfig, resolveDataDir } from './config.js';
import type { Config } from './config.js';
import { registerTools } from './tools/register.js';
import { detectProject } from './utils/project.js';

export interface ServerDeps {
  readonly config: Config;
}

export async function startServer(deps?: Partial<ServerDeps>): Promise<void> {
  const config = deps?.config ?? loadConfig();
  const dataDir = resolveDataDir(config.dataDir);

  const db = createDatabase({ dataDir });
  migrate(db);

  const memoryRepo = new MemoryRepo(db);
  const relationRepo = new RelationRepo(db);
  const searchRepo = new SearchRepo(db);

  const retrievalService = new RetrievalService({
    memoryRepo,
    relationRepo,
    searchRepo,
  });

  const server = new McpServer(
    { name: 'agentic-memory', version: '0.1.0' },
    {
      instructions:
        'Use memory_search before memory_store to check for duplicates. '
        + 'Use memory_update to modify existing memories instead of creating duplicates - it preserves access history. '
        + 'Store memories at the semantic level - capture WHY, not just WHAT happened. '
        + 'Only store knowledge worth remembering across sessions. '
        + 'NEVER store credentials, API keys, tokens, passwords, or secrets - memories may be synced to external storage. '
        + 'Memory context is automatically injected at session start via hook - no need to call memory_recent manually.',
    },
  );

  const project = detectProject(process.cwd());

  registerTools(server, { memoryRepo, relationRepo, retrievalService, dataDir, project });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    await server.close();
    closeDatabase(db);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

// Auto-start when invoked directly as MCP server entry point
startServer().catch((err) => {
  process.stderr.write(`[agentic-memory] ${err}\n`);
  process.exit(1);
});
