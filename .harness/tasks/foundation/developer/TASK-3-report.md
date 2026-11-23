# TASK-3 report — Anonymous deviceId cookie mint/read and row scoping

## Status

done

## Commit

- SHA: `51712a5`
- Message: `feat(TASK-3): Anonymous deviceId cookie mint/read and row scoping`

## What changed

- `src/lib/auth/device-id.ts` — `getOrMintDeviceId` / `parseDeviceIdCookie`; cookie attrs HttpOnly, SameSite=Lax, Path=/, Max-Age=31536000; re-mints when value is missing or not a UUID.
- `src/middleware.ts` — mints `deviceId` on first matched request via `Set-Cookie`.
- `src/lib/auth/device-id.test.ts` — mint, stable read, invalid-value re-mint, cookie-attr assertions.

Row scoping was already enforced by TASK-2 (`createProject` requires `deviceId`; `getProject` filters by `device_id`).

## Checks (fresh)

- `pnpm exec vitest run src/lib/auth` → 1 file / 7 tests pass
- `pnpm typecheck` → pass

## Decisions within contract

- Pure Cookie-header helpers (no Next `cookies()` dependency) so Vitest can exercise mint/read without a request fixture.
- Invalid non-UUID `deviceId` cookie values are treated as absent and re-minted.
- Middleware matcher skips `_next/static`, `_next/image`, and `favicon.ico`.

## Not done / deferred

- Playwright cookie persistence assertions (TASK-5 / e2e).
- No LLM / rate-limit work (TASK-4).
