import blessed from "blessed";
import { createDatabase, closeDatabase } from "../storage/database.js";
import { migrate } from "../storage/migrator.js";
import { MemoryRepo } from "../storage/memory-repo.js";
import { RelationRepo } from "../storage/relation-repo.js";
import { SearchRepo } from "../storage/search-repo.js";
import { loadConfig, resolveDataDir } from "../config.js";
import { DashboardDataSource } from "./data/data-source.js";
import { createDashboard } from "./layout.js";

// -- TUI Entry Point ----------------------------------------------------------

export interface TuiOptions {
  readonly dbPath?: string;
}

export async function startTui(options?: TuiOptions): Promise<void> {
  // Work around blessed bug with xterm-256color Setulc parsing
  if (process.env["TERM"]?.includes("256color")) {
    process.env["TERM"] = "xterm";
  }

  // -- Initialize storage -----------------------------------------------------
  const config = loadConfig(
    options?.dbPath ? { dataDir: options.dbPath } : undefined,
  );
  const dataDir = resolveDataDir(config.dataDir);
  const db = createDatabase({ dataDir });
  migrate(db);

  const memoryRepo = new MemoryRepo(db);
  const relationRepo = new RelationRepo(db);
  const searchRepo = new SearchRepo(db);

  // -- Create blessed screen --------------------------------------------------
  const screen = blessed.screen({
    smartCSR: true,
    title: "agentic-memory",
  });

  // -- Create data source and dashboard ---------------------------------------
  const dataSource = new DashboardDataSource(
    memoryRepo,
    relationRepo,
    searchRepo,
    dataDir,
  );

  // -- Unified shutdown -- all exit paths go through here ---------------------
  let shuttingDown = false;
  function shutdown(): void {
    if (shuttingDown) return;
    shuttingDown = true;
    dataSource.stopWatching();
    screen.destroy();
    closeDatabase(db);
  }

  const dashboard = createDashboard(screen, dataSource, { onQuit: shutdown });

  // -- Initial render ---------------------------------------------------------
  dashboard.refresh();

  // -- Start file watching ----------------------------------------------------
  dataSource.startWatching(() => {
    dashboard.refresh();
  });

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // -- Crash guard -- always clean up the terminal ----------------------------
  process.on("uncaughtException", (err) => {
    dataSource.stopWatching();
    screen.destroy();
    closeDatabase(db);
    process.stderr.write(
      `[agentic-memory] dashboard crashed: ${err.message}\n`,
    );
    process.exit(1);
  });
}
