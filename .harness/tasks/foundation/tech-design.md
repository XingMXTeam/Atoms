# Tech design — foundation

## 1. Stack and key dependencies

Confirmed as the repo (D3 / package.json). No new frameworks.

- Next.js App Router 16 + React 19 + TypeScript strict
- Tailwind CSS v4 via `@tailwindcss/turbopack`
- `@opennextjs/cloudflare` + `wrangler`
- `drizzle-orm` + `drizzle-kit`
- `better-sqlite3` for local Next / Vitest / Playwright
- `zod` for env and input validation
- Playwright + Vitest (existing)

Named additions allowed only as wiring of the above (e.g. `server-only`, cookie helpers already in Next). Do not add WebContainer, vinext, or CDN-loaded UI kits.

## 2. Architecture overview

```
Browser  →  Next.js (App Router)
               ├─ `/` Chinese placeholder home
               ├─ middleware / server helper: mint & read `deviceId` cookie
               └─ server libs:
                    db/          Drizzle schema + repository interface
                      ├─ d1 adapter (Workers binding DB)
                      └─ sqlite adapter (better-sqlite3)
                    llm/         provider: gemini | mock | replay
                    limits/      DEVICE_DAILY_RUN_LIMIT + DAILY_TOKEN_CAP
OpenNext → Cloudflare Worker (placement aws:us-east-1, route atoms.maoxunxing.com)
```

## 3. Modules and boundaries

| Module | Path | Owns |
|---|---|---|
| Home UI | `src/app/page.tsx`, `layout.tsx`, `globals.css` | Chinese placeholder shell |
| Device identity | `src/lib/auth/device-id.ts` (+ middleware if needed) | mint/read HttpOnly cookie |
| Schema | `src/lib/db/schema.ts` | Drizzle tables listed in REQ-3 |
| Repository | `src/lib/db/repository.ts` + `adapters/{sqlite,d1}.ts` | CRUD behind one interface |
| Env | `src/lib/env.ts` | zod-parsed server env |
| LLM provider | `src/lib/llm/provider.ts` + `modes/{gemini,mock,replay}.ts` | mode selection + payloads |
| Rate limits | `src/lib/limits/rate-limit.ts` | daily run + token gates |
| OpenNext / CF | `next.config.ts`, `open-next.config.ts`, `wrangler.jsonc` | deploy path |

Routes never import another route. Client components do not import db/llm/secrets (`server-only`).

## 4. Data flow and state

- **deviceId:** on first request without cookie → generate UUID → Set-Cookie (`HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age≈31536000`). All project/run/usage writes include `device_id`.
- **Repository:** `getDb()` chooses D1 binding on Workers, better-sqlite3 file (e.g. `.data/local.sqlite`) locally / in tests.
- **Usage:** `usage` table keyed by `(device_id, day)` with `runs` and `tokens` counters.
- **Provider selection:** `LLM_PROVIDER` env → factory. On gemini transport/quota failure or rate-limit soft cap → switch to `replay` and mark response/meta `label: "演示回放"`.
- UI states for F1: home is static success; no empty/error UI beyond clear Chinese system messages from limit/provider helpers (consumed by later features).

### State shape (server)

```ts
type DeviceId = string; // uuid
type ProviderMode = "gemini" | "mock" | "replay";
type RateLimitDecision =
  | { ok: true; mode: ProviderMode }
  | { ok: false; mode: "replay"; label: "演示回放" }
  | { ok: false; refuse: true; messageZh: string };
```

## 5. API / interface contracts

F1 does not ship public product APIs beyond what tests need. Internal contracts:

```ts
interface AppRepository {
  createProject(input: { deviceId: string; title: string }): Promise<Project>;
  getProject(id: string, deviceId: string): Promise<Project | null>;
  // messages / runs / agent_events / versions / usage helpers as needed by tests
  incrementUsage(deviceId: string, day: string, delta: { runs?: number; tokens?: number }): Promise<UsageRow>;
  getUsage(deviceId: string, day: string): Promise<UsageRow | null>;
}

interface LlmProvider {
  mode: ProviderMode;
  complete(input: unknown): Promise<{ text: string; meta: { mode: ProviderMode; label?: "演示回放" } }>;
}

function assertRateLimit(deviceId: string): Promise<RateLimitDecision>;
function getOrMintDeviceId(cookieHeader: string | null): { deviceId: string; setCookie?: string };
```

## 6. Error handling

| Failure | User-visible | Retry | Log |
|---|---|---|---|
| Over `DEVICE_DAILY_RUN_LIMIT` | degrade to replay + 「演示回放」, else Chinese refuse message | next UTC day | usage row |
| Over `DAILY_TOKEN_CAP` | same as above | next UTC day | usage row |
| Gemini error/timeout | auto `replay` + label | caller may retry later | provider error |
| SQLite/D1 write failure | throw typed error; tests assert | no silent swallow | error |
| Missing `GEMINI_API_KEY` in gemini mode | fall back to replay in demo, or clear Chinese config error | fix env | warning |

## 7. Test strategy

- **Unit (Vitest):** deviceId mint/read; provider mode selection (`mock` fixed payload); rate-limit when runs exceeded; repository insert/read project via SQLite adapter.
- **E2E (Playwright, `LLM_PROVIDER=mock`):** home Chinese title; `deviceId` cookie set on first visit and persisted on reload.
- **Verify:** `fh verify` ids `typecheck`, `lint`, `unit`, `e2e`, `build`.
- **Static:** grep/scan for CDN URLs and committed secrets.

## 8. Run instructions

- Install: `pnpm install`
- Dev: `pnpm dev` → `http://127.0.0.1:3000`
- Eval/capture base: `http://127.0.0.1:3000` (Playwright uses `pnpm exec next start --port 3000` after build)
- Frontend working directory: repository root

## 9. Risks and trade-offs

- Placeholder D1 `database_id` until owner runs `wrangler login` / `d1 create` — accepted non-goal; local SQLite unblocks all verify.
- IP-per-minute limit from D11 deferred if not in REQ-6; F1 implements device daily + global token caps only.
- OpenNext SSE quirks deferred to F2; F1 only proves config + Worker placement.

## 10. Overview deltas

- Product: foundation capability area (scaffold, persistence, provider, limits).
- Technical: Drizzle repository dual-adapter pattern; LLM provider factory; deviceId cookie scheme.
