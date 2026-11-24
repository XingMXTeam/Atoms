import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createAppRepository, type AppRepository } from "../repository";
import * as schema from "../schema";

const MIGRATION_FILES = ["0000_init.sql", "0001_preview_probes.sql"] as const;

function loadSchemaSql(): string {
  const base = path.join(/*turbopackIgnore: true*/ process.cwd(), "migrations");
  return MIGRATION_FILES.map((file) =>
    fs.readFileSync(path.join(base, file), "utf8"),
  ).join("\n");
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
  sqlite.exec(loadSchemaSql());

  const db = drizzle(sqlite, { schema });
  return createAppRepository(db);
}
