import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createAppRepository, type AppRepository } from "../repository";
import * as schema from "../schema";

function loadSchemaSql(): string {
  const migrationPath = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "migrations",
    "0000_init.sql",
  );
  return fs.readFileSync(migrationPath, "utf8");
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
