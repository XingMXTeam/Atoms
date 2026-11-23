# TASK-4 report — LLM provider modes + daily rate-limit gates

## Status

done

## Commit

- SHA: `76252a0`
- Message: `feat(TASK-4): LLM provider modes + daily rate-limit gates`

## What changed

- `src/lib/env.ts` — zod-parsed server env (`LLM_PROVIDER`, `GEMINI_API_KEY`, `DEVICE_DAILY_RUN_LIMIT`, `DAILY_TOKEN_CAP`) with `.env.example` defaults.
- `src/lib/llm/types.ts` — `LlmProvider` / `LlmCompletion` contracts.
- `src/lib/llm/modes/mock.ts` — deterministic fixed payload for tests.
- `src/lib/llm/modes/replay.ts` — pre-recorded demo completion labelled 「演示回放」.
- `src/lib/llm/modes/gemini.ts` — gemini shell; missing key / transport failure auto-falls back to replay + label.
- `src/lib/llm/provider.ts` — factory selected by `LLM_PROVIDER`.
- `src/lib/limits/rate-limit.ts` — `assertRateLimit`: under-cap ok; over run/token cap → replay + 「演示回放」; refuse Chinese message only when `replayAvailable: false`.
- Tests: `src/lib/llm/provider.test.ts`, `src/lib/limits/rate-limit.test.ts`.

## Checks (fresh)

- `pnpm exec vitest run src/lib/llm src/lib/limits` → 2 files / 7 tests pass
- `pnpm typecheck` → pass

## Decisions within contract

- Inject usage readers into `assertRateLimit` so unit tests do not need a live DB; repository wiring stays for later features.
- Gemini live REST streaming deferred to generate-loop; F1 proves mode selection + missing-key / transport fallback.
- IP-per-minute limit remains deferred (tech-design §9).

## Not done / deferred

- Wire `assertRateLimit` into generate routes (F2).
- Live Gemini `streamGenerateContent` transport (F2).
- Global token aggregation helper over all devices (caller supplies `getGlobalTokens`).
