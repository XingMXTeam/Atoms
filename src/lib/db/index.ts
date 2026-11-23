import { createD1Repository, type D1Binding } from "./adapters/d1";
import { createSqliteRepository } from "./adapters/sqlite";
import type { AppRepository } from "./repository";

export type {
  AppRepository,
  Message,
  Project,
  Run,
  UsageRecord,
} from "./repository";
export type { D1Binding } from "./adapters/d1";
export * from "./schema";

const DEFAULT_SQLITE_PATH = ".data/local.sqlite";

let cached: AppRepository | null = null;

/**
 * Returns the app repository. Local Next / Vitest / Playwright use better-sqlite3;
 * Workers pass the D1 binding via `getCloudflareContext` (wired by callers).
 */
export function getDb(options?: {
  d1?: D1Binding;
  sqlitePath?: string;
}): AppRepository {
  if (options?.d1) {
    return createD1Repository(options.d1);
  }

  if (!cached) {
    cached = createSqliteRepository(options?.sqlitePath ?? DEFAULT_SQLITE_PATH);
  }
  return cached;
}

/** Test helper: drop the process-local sqlite cache. */
export function resetDbCache(): void {
  cached = null;
}
