# TASK-1 report — Lock Chinese home + OpenNext/Workers config + env example

## Status

done

## Commit

- SHA: `3f81432`
- Message: `feat(TASK-1): lock Chinese home, OpenNext/Workers config, and env example`

## What changed

- Added `src/lib/config/foundation-lock.test.ts` to pin REQ-1 / REQ-2 / REQ-7 against the scaffold already in tree:
  - Chinese `lang="zh-CN"`, document title, and H1 「可验证的 AI 应用生成」
  - `initOpenNextCloudflareForDev`, OpenNext Cloudflare config, wrangler name/placement/route/D1 binding + placeholder comment
  - `.env.example` keys `GEMINI_API_KEY`, `LLM_PROVIDER`, `DAILY_TOKEN_CAP`, `DEVICE_DAILY_RUN_LIMIT` with empty secret value
  - no Google Fonts / esm.sh / unpkg / jsdelivr / Tailwind CDN in home sources

No product-file edits were required: `page.tsx`, `layout.tsx`, `globals.css`, `next.config.ts`, `open-next.config.ts`, `wrangler.jsonc`, and `.env.example` already matched the contract from the scaffold commit.

## Checks (fresh)

- `pnpm typecheck` → pass
- `pnpm exec vitest run src/lib/cn.test.ts` → 1 file / 1 test pass
- `test -f .env.example` → pass
- `rg -n "atoms.maoxunxing.com|aws:us-east-1|initOpenNextCloudflareForDev" wrangler.jsonc next.config.ts open-next.config.ts` → matches in next.config.ts + wrangler.jsonc
- `pnpm exec vitest run src/lib/config` → 1 file / 4 tests pass

## Decisions within contract

- Kept existing zinc/system-font home shell (REF-1); only locked it with tests rather than restyling.
- Left placeholder D1 `database_id` as documented non-goal.

## Not done / deferred

- No TASK-2+ work (db / auth / llm / e2e wiring).
