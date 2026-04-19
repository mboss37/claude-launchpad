import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const require = createRequire(import.meta.url);
const { version } = require('../../../package.json') as { version: string };
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
    { name: 'agentic-memory', version },
    {
      instructions:
        'This is your knowledge base — persistent context that survives across sessions. '
        + 'Search before storing to avoid duplicates. Update existing memories instead of creating new ones. '
        + 'Store decisions, patterns, and insights — capture WHY, not just WHAT. '
        + 'Only save what future sessions will need. NEVER store secrets, API keys, or passwords. '
        + 'Session context is injected automatically at startup — no need to call memory_recent.',
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

// Auto-start only when this file is run directly as the entry point
// (e.g. `node dist/memory/server.js`). When imported by cli.ts's `memory serve`
// command, the action handler calls startServer() explicitly — auto-starting
// here too would spawn two instances on the same stdio pipe and break MCP.
function isMainEntry(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(argv1);
  } catch {
    return false;
  }
}

if (isMainEntry()) {
  startServer().catch((err) => {
    process.stderr.write(`[agentic-memory] ${err}\n`);
    process.exit(1);
  });
}
