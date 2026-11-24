# Dev plan — foundation

### TASK-1: Lock Chinese home + OpenNext/Workers config + env example

**Goal** — Confirm the Chinese placeholder home and Cloudflare deploy/env docs match REQ-1/2/7 with no CDN refs.

**Files**
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`
- Modify: `next.config.ts`, `open-next.config.ts`, `wrangler.jsonc`, `.env.example`
- Tests: keep `src/lib/cn.test.ts`; add config assertion tests only if needed under `src/lib/config/`

**Contract**
- Document title / H1 convey 「Atoms Studio — 可验证的 AI 应用生成」 / 「可验证的 AI 应用生成」.
- `wrangler.jsonc`: name `atoms-demo`, placement `aws:us-east-1`, route `atoms.maoxunxing.com`, D1 binding `DB` with commented placeholder id.
- `.env.example` lists `GEMINI_API_KEY`, `LLM_PROVIDER`, `DAILY_TOKEN_CAP`, `DEVICE_DAILY_RUN_LIMIT`.

**Verify**
- `pnpm typecheck`
- `rg` presence checks for OpenNext/wrangler fields
- No Google Fonts / esm.sh / unpkg / jsdelivr / Tailwind CDN in `src/**`

### TASK-2: Drizzle schema + repository with better-sqlite3 adapter

**Goal** — Ship Drizzle tables and a repository interface with a working SQLite adapter for local/tests.

**Files**
- Create: `src/lib/db/schema.ts`, `src/lib/db/repository.ts`, `src/lib/db/adapters/sqlite.ts`, `src/lib/db/adapters/d1.ts`, `src/lib/db/index.ts`
- Tests: `src/lib/db/repository.test.ts`

**Contract**
- Tables: `projects`, `messages`, `runs`, `agent_events`, `versions`, `usage` with fields from implementation_plan §4.
- `createProject` / `getProject` round-trip on SQLite without Wrangler auth.

**Verify**
- `pnpm exec vitest run src/lib/db` — repository smoke passes
- `pnpm typecheck`

### TASK-3: Anonymous deviceId cookie mint/read and row scoping

**Goal** — First visit mints long-lived HttpOnly SameSite=Lax `deviceId`; repository writes are scoped by it.

**Files**
- Create: `src/lib/auth/device-id.ts`
- Modify: `src/middleware.ts` (or Next server entry that sets the cookie on `/`)
- Tests: `src/lib/auth/device-id.test.ts`

**Contract**
- `getOrMintDeviceId`: stable read; mint UUID when absent; cookie attrs HttpOnly, SameSite=Lax, Path=/, Max-Age≈31536000.
- Project create requires `deviceId` and stores `device_id`.

**Verify**
- `pnpm exec vitest run src/lib/auth`
- `pnpm typecheck`

### TASK-4: LLM provider modes + daily rate-limit gates

**Goal** — `LLM_PROVIDER` selects gemini|mock|replay; caps enforce degrade/refuse paths with Chinese labelling.

**Files**
- Create: `src/lib/env.ts`, `src/lib/llm/provider.ts`, `src/lib/llm/modes/mock.ts`, `src/lib/llm/modes/replay.ts`, `src/lib/llm/modes/gemini.ts`, `src/lib/limits/rate-limit.ts`
- Tests: `src/lib/llm/provider.test.ts`, `src/lib/limits/rate-limit.test.ts`

**Contract**
- `mock.complete` returns deterministic fixed payload.
- Over `DEVICE_DAILY_RUN_LIMIT` or `DAILY_TOKEN_CAP` → `{ mode: "replay", label: "演示回放" }` or Chinese refuse message.

**Verify**
- `pnpm exec vitest run src/lib/llm src/lib/limits`
- `pnpm typecheck`

### TASK-5: Wire verify suite: unit coverage, e2e smoke, build green

**Goal** — Acceptance unit coverage + Playwright smoke + all five verify gates green under `LLM_PROVIDER=mock`.

**Files**
- Modify: `e2e/smoke.spec.ts` (title + cookie persistence)
- Modify: package scripts only if required for verify
- Tests: ensure unit files from TASK-2..4 are included in `pnpm test`

**Contract**
- Unit coverage includes deviceId, mock provider, rate-limit exceeded, repository smoke.
- E2E: home H1 visible; `deviceId` cookie present after first visit and after reload.
- `fh verify` can record typecheck/lint/unit/e2e/build.

**Verify**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- `LLM_PROVIDER=mock pnpm test:e2e` (run under verify)

## Editable scope
- `src/**`
- `e2e/**`
- `next.config.ts`
- `open-next.config.ts`
- `wrangler.jsonc`
- `.env.example`
- `package.json`
- `drizzle.config.*`
- `.harness/tasks/foundation/**`
