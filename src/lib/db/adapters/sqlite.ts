import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createAppRepository, type AppRepository } from "../repository";
import * as schema from "../schema";

const MIGRATION_FILES = [
  "0000_init.sql",
  "0001_preview_probes.sql",
  "0002_project_state.sql",
  "0003_platform_budget.sql",
] as const;

const sqliteHandles = new WeakMap<AppRepository, Database.Database>();

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

function applyMigrations(sqlite: Database.Database): void {
  const base = path.join(/*turbopackIgnore: true*/ process.cwd(), "migrations");
  for (const file of MIGRATION_FILES) {
    const sql = fs.readFileSync(path.join(base, file), "utf8");
    for (const statement of splitSqlStatements(sql)) {
      try {
        sqlite.exec(statement);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Local files are migrated on every open. ALTER is not idempotent.
        if (/duplicate column name/i.test(message)) continue;
        throw error;
      }
    }
  }
}

/** Test helper: true when any persisted cell contains `needle` (for secret leaks). */
export function sqliteContainsText(repo: AppRepository, needle: string): boolean {
  const sqlite = sqliteHandles.get(repo);
  if (!sqlite) {
    throw new Error("sqlite handle missing for repository");
  }
  const tables = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all() as Array<{ name: string }>;
  for (const { name } of tables) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) continue;
    const rows = sqlite.prepare(`SELECT * FROM "${name}"`).all();
    if (JSON.stringify(rows).includes(needle)) return true;
  }
  return false;
}

export function createSqliteRepository(
  filename: string = ".data/local.sqlite",
): AppRepository {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(/*turbopackIgnore: true*/ filename)), {
      recursive: true,
    });
  }

  const sqlite = new Database(filename);
  if (filename !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  applyMigrations(sqlite);

  const db = drizzle(sqlite, { schema });
  const repo = createAppRepository(db);
  sqliteHandles.set(repo, sqlite);
  return repo;
}
