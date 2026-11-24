import { readCloudflareEnv } from "@/lib/cloudflare";
import { createD1Repository, type D1Binding } from "./adapters/d1";
import type { AppRepository } from "./repository";

export const D1_BOOKMARK_COOKIE = "d1Bookmark";

type D1Session = D1Binding & {
  getBookmark?: () => string | null;
};

type D1WithSession = D1Binding & {
  withSession?: (constraint: string) => D1Session;
};

const repoBookmarks = new WeakMap<AppRepository, () => string | null>();

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
function bindD1Session(binding: D1Binding, constraint: string): D1Binding {
  const candidate = binding as D1WithSession;
  if (typeof candidate.withSession !== "function") return binding;
  return candidate.withSession(constraint);
}

export function readD1Bookmark(repo: AppRepository): string | null {
  const bookmark = repoBookmarks.get(repo)?.() ?? null;
  if (!bookmark || bookmark.length > 512) return null;
  return bookmark;
}

export function decodeD1Bookmark(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded || decoded.length > 512) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function d1BookmarkSetCookie(bookmark: string, secure: boolean): string {
  const parts = [
    `${D1_BOOKMARK_COOKIE}=${encodeURIComponent(bookmark)}`,
    "Path=/",
    "Max-Age=3600",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function getDb(options?: {
  d1?: D1Binding;
  sqlitePath?: string;
  /** D1 sessions bookmark or `first-primary` / `first-unconstrained`. */
  d1Session?: string;
}): AppRepository {
  const d1 = options?.d1 ?? tryGetCloudflareD1();
  if (d1) {
    const constraint = options?.d1Session ?? "first-unconstrained";
    const bound = bindD1Session(d1, constraint);
    const repo = createD1Repository(bound);
    repoBookmarks.set(repo, () => {
      const session = bound as D1Session;
      const bookmark = session.getBookmark?.() ?? null;
      return bookmark && bookmark.length > 0 ? bookmark : null;
    });
    return repo;
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
