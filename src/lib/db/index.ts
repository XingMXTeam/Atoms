import { readCloudflareEnv } from "@/lib/cloudflare";
import { createD1Repository, type D1Binding } from "./adapters/d1";
import type { AppRepository } from "./repository";

export type {
  AgentEvent,
  AppRepository,
  Message,
  Project,
  Run,
  UsageRecord,
  Version,
} from "./repository";
export type { D1Binding } from "./adapters/d1";
export * from "./schema";

const DEFAULT_SQLITE_PATH = ".data/local.sqlite";

let cached: AppRepository | null = null;

function isWorkersRuntime(): boolean {
  if (typeof process !== "undefined" && process.env?.USE_CLOUDFLARE_D1 === "1") {
    return true;
  }
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
  );
}

function tryGetCloudflareD1(): D1Binding | undefined {
  if (!isWorkersRuntime()) return undefined;
  return readCloudflareEnv()?.DB as D1Binding | undefined;
}

/**
 * Returns the app repository.
 * Inside Cloudflare Workers (`workerd`), binds directly to `env.DB` (D1).
 * In local Node (`next dev` / `next start` / Vitest / Playwright), lazily loads `better-sqlite3`.
 */
export function getDb(options?: {
  d1?: D1Binding;
  sqlitePath?: string;
}): AppRepository {
  const d1 = options?.d1 ?? tryGetCloudflareD1();
  if (d1) {
    return createD1Repository(d1);
  }

  if (!cached) {
    // Load the native SQLite adapter lazily on Node so Cloudflare Workers never execute it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createSqliteRepository } = require("./adapters/sqlite") as typeof import("./adapters/sqlite");
    cached = createSqliteRepository(options?.sqlitePath ?? DEFAULT_SQLITE_PATH);
  }
  return cached;
}

/** Test helper: drop the process-local sqlite cache. */
export function resetDbCache(): void {
  cached = null;
}
