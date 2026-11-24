# TASK-2 report — Drizzle schema + repository with better-sqlite3 adapter

## Status

done

## Commit

- SHA: `b02c3d9`
- Message: `feat(TASK-2): Drizzle schema + repository with better-sqlite3 adapter`

## What changed

- `src/lib/db/schema.ts` — Drizzle sqlite tables: `projects`, `messages`, `runs`, `agent_events`, `versions`, `usage` (fields from implementation_plan §4).
- `src/lib/db/repository.ts` — `AppRepository` with `createProject` / `getProject` / `incrementUsage` / `getUsage`.
- `src/lib/db/adapters/sqlite.ts` — better-sqlite3 adapter + inline `CREATE TABLE IF NOT EXISTS` bootstrap (memory or `.data/local.sqlite`).
- `src/lib/db/adapters/d1.ts` — Workers D1 binding adapter (migrations assumed applied).
- `src/lib/db/index.ts` — `getDb()` chooses D1 when passed, else cached sqlite.
- `src/lib/db/repository.test.ts` — project round-trip + usage increment smoke (node env).
- `drizzle.config.ts` — drizzle-kit config pointing at schema.
- `.gitignore` — ignore `.data/` for local sqlite files.

## Checks (fresh)

- `pnpm exec vitest run src/lib/db` → 1 file / 2 tests pass
- `pnpm typecheck` → pass

## Decisions within contract

- Used `D1Binding = Parameters<typeof drizzle>[0]` instead of global `D1Database` so we do not add `@cloudflare/workers-types`.
- SQLite adapter applies schema SQL on open so Vitest needs no Wrangler/migrations.
- Repository interface matches tech-design `AppRepository` contract; further message/run/event helpers deferred until features need them.

## Not done / deferred

- No deviceId cookie wiring (TASK-3).
- No D1 migration SQL applied in Workers (placeholder database_id remains).
- No LLM / rate-limit work (TASK-4).
