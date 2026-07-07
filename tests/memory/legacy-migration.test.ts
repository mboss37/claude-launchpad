import { describe, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import DatabaseConstructor from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import * as m001 from "../../src/commands/memory/storage/migrations/001-initial.js";
import * as m002 from "../../src/commands/memory/storage/migrations/002-add-project.js";
import * as m003 from "../../src/commands/memory/storage/migrations/003-add-content-hash.js";
import * as m004 from "../../src/commands/memory/storage/migrations/004-add-tombstones.js";
import {
  migrate,
  getSchemaVersion,
} from "../../src/commands/memory/storage/migrator.js";

// Toggled per test: simulates a machine where sqlite-vec was uninstalled.
let vecModuleAvailable = true;
vi.mock(
  "../../src/commands/memory/utils/require-deps.js",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../src/commands/memory/utils/require-deps.js")
      >();
    return {
      ...actual,
      cwdRequire: (name: string) => {
        if (name === "sqlite-vec" && !vecModuleAvailable) {
          throw new Error(`Cannot find module '${name}'`);
        }
        return actual.cwdRequire(name);
      },
    };
  },
);

/**
 * Builds the exact on-disk shape a real v1.13 install has (schema version 4,
 * vec0 virtual table, embedding column), then CLOSES it. sqlite-vec is a
 * devDep ONLY for this fixture — runtime code no longer loads it.
 */
function createLegacyV13DbFile(): string {
  const dbPath = join(mkdtempSync(join(tmpdir(), "legacy-db-")), "memory.db");
  const db = new DatabaseConstructor(dbPath);
  sqliteVec.load(db);
  db.pragma("foreign_keys = ON");
  for (const m of [m001, m002, m003, m004]) m.up(db);
  db.exec("ALTER TABLE memories ADD COLUMN embedding BLOB");
  db.exec(`CREATE VIRTUAL TABLE memories_vec USING vec0(
    memory_id TEXT PRIMARY KEY,
    embedding float[384] distance_metric=cosine
  )`);
  db.prepare(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '4')",
  ).run();
  db.prepare(
    `
    INSERT INTO memories (id, type, content, tags, importance, created_at, updated_at, content_hash)
    VALUES ('legacy-1', 'semantic', 'survived the upgrade', '[]', 0.7, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 'hash-legacy-1')
  `,
  ).run();
  db.close();
  return dbPath;
}

// Reopen exactly the way v1.14 production does: NO extension load.
function reopenClean(dbPath: string): DatabaseConstructor.Database {
  const db = new DatabaseConstructor(dbPath);
  db.pragma("foreign_keys = ON");
  return db;
}

function assertUpgraded(db: DatabaseConstructor.Database): void {
  expect(getSchemaVersion(db)).toBe(7);
  const vec = db
    .prepare("SELECT 1 FROM sqlite_master WHERE name = 'memories_vec'")
    .get();
  expect(vec).toBeUndefined();
  const cols = db
    .prepare("SELECT name FROM pragma_table_info('memories')")
    .all() as { name: string }[];
  expect(cols.map((c) => c.name)).not.toContain("embedding");
  expect(cols.map((c) => c.name)).toContain("base_importance");
  const row = db
    .prepare(
      "SELECT importance, base_importance FROM memories WHERE id = 'legacy-1'",
    )
    .get() as {
    importance: number;
    base_importance: number;
  };
  expect(row.importance).toBeCloseTo(0.7, 6);
  expect(row.base_importance).toBeCloseTo(0.7, 6);
}

describe("v1.13 → v1.14 upgrade (review Critical 1)", () => {
  it("upgrades a reopened legacy DB when sqlite-vec is still installed", () => {
    vecModuleAvailable = true;
    const db = reopenClean(createLegacyV13DbFile());
    migrate(db);
    assertUpgraded(db);
    db.close();
  });

  it("still completes the upgrade when sqlite-vec is gone (vtab entry stays, inert)", () => {
    vecModuleAvailable = false;
    const db = reopenClean(createLegacyV13DbFile());
    migrate(db);

    expect(getSchemaVersion(db)).toBe(7);
    const cols = db.prepare("SELECT name FROM pragma_table_info('memories')").all() as { name: string }[];
    expect(cols.map((c) => c.name)).not.toContain("embedding");
    expect(cols.map((c) => c.name)).toContain("base_importance");
    // The dead vtab entry is allowed to remain — nothing queries it, and the
    // DB stays fully usable:
    const row = db.prepare("SELECT importance FROM memories WHERE id = 'legacy-1'").get() as { importance: number };
    expect(row.importance).toBeCloseTo(0.7, 6);
    db.close();
  });
});
