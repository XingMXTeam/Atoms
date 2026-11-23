# F1 — Foundation

Scaffold, deploy path, persistence, provider abstraction, and verify gates so every later feature can build on a stable base.

## Requirements

- **REQ-1** Next.js App Router + TypeScript + Tailwind v4 project runs locally with `pnpm dev` and produces a Chinese placeholder home: title **Atoms Studio — 可验证的 AI 应用生成**.
- **REQ-2** OpenNext Cloudflare adapter configured (`next.config.ts` calls `initOpenNextCloudflareForDev`, `open-next.config.ts`, `wrangler.jsonc` name `atoms-demo`, placement `aws:us-east-1`, custom-domain route `atoms.maoxunxing.com`, D1 binding `DB`).
- **REQ-3** Drizzle schema + repository interface for D1 tables: `projects`, `messages`, `runs`, `agent_events`, `versions`, `usage`. Local Next.js / Vitest / Playwright use better-sqlite3 (or libsql) behind the same interface; Workers use the D1 binding.
- **REQ-4** Anonymous `deviceId` cookie issued on first visit (HttpOnly, SameSite=Lax, long-lived); all project/run/usage rows are scoped by it.
- **REQ-5** LLM provider abstraction with modes `gemini` | `mock` | `replay`, selected by `LLM_PROVIDER`. `mock` is deterministic for tests; `replay` auto-fallback is labelled clearly when activated.
- **REQ-6** Rate limits: per-`deviceId` daily run cap (`DEVICE_DAILY_RUN_LIMIT`) and global daily token cap (`DAILY_TOKEN_CAP`); over-cap paths degrade to `replay` (or refuse with a clear Chinese message).
- **REQ-7** Env documented in `.env.example` (`GEMINI_API_KEY`, `LLM_PROVIDER`, `DAILY_TOKEN_CAP`, `DEVICE_DAILY_RUN_LIMIT`). Secrets never committed.
- **REQ-8** Verify gates green: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:e2e` (with `LLM_PROVIDER=mock`), `pnpm build`. `fh verify` records all five check ids.

## Non-goals

- Live Gemini calls in CI / e2e (use `mock`).
- Actual `wrangler login` / real D1 `database_id` provisioning (owner action; placeholder id is fine).
- Agent pipeline UI, preview bundling, QA, share/zip (F2–F4).
- Pixel-copy of Atoms or any external CDN dependency.

## Acceptance criteria

1. `fh verify` passes with checks `typecheck`, `lint`, `unit`, `e2e`, `build`.
2. Visiting `/` shows the Chinese product title; Playwright smoke asserts it.
3. Unit tests cover at least: `deviceId` minting/read path, provider mode selection (`mock` returns a fixed payload), and rate-limit gate when daily runs exceeded.
4. A repository smoke test inserts/reads a project row via the SQLite adapter without requiring Wrangler auth.
5. `wrangler.jsonc` documents the placeholder D1 id with a clear comment; `.env.example` lists all four env vars.
6. No Google Fonts / esm.sh / unpkg / jsdelivr / Tailwind CDN references in app source.
