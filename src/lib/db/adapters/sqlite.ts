import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { createAppRepository, type AppRepository } from "../repository";
import * as schema from "../schema";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  title TEXT NOT NULL,
  current_version_id TEXT,
  share_slug TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS projects_share_slug_unique ON projects(share_slug);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  status TEXT NOT NULL,
  qa_rounds INTEGER NOT NULL DEFAULT 0,
  qa_score INTEGER,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL,
  finished_at INTEGER
);

CREATE TABLE IF NOT EXISTS agent_events (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES runs(id),
  seq INTEGER NOT NULL,
  agent TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id),
  run_id TEXT NOT NULL REFERENCES runs(id),
  parent_id TEXT,
  files TEXT NOT NULL,
  acceptance TEXT NOT NULL,
  qa_score INTEGER,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS usage (
  device_id TEXT NOT NULL,
  day TEXT NOT NULL,
  runs INTEGER NOT NULL DEFAULT 0,
  tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, day)
);
`;

export function createSqliteRepository(
  filename: string = ".data/local.sqlite",
): AppRepository {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }

  const sqlite = new Database(filename);
  if (filename !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
  }
  sqlite.exec(SCHEMA_SQL);

  const db = drizzle(sqlite, { schema });
  return createAppRepository(db);
}
