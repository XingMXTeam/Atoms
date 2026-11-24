# Clarification questions — foundation (imported PRD, gap-only)

Imported PRD: `.harness/tasks/foundation/prd.md` from `docs/prd/F1-foundation.md`.
Authoritative answers already exist in `docs/plan/decisions.md` (user-approved 2026-11-23).
Product owner unavailable overnight — gap-only pass; no interactive re-interview.

## Batch 1 — gaps the imported PRD leaves open

1. Over-cap behaviour when both daily run and token caps trip: prefer degrade-to-`replay` with a clear Chinese 「演示回放」 label, or hard refuse?
2. Quality level for the placeholder home in F1: working MVP, polished, or production?
3. Local SQLite backend for the shared repository interface: better-sqlite3 (already in package.json) or libsql?
4. Default numeric caps if env unset: use `.env.example` values (`DEVICE_DAILY_RUN_LIMIT=20`, `DAILY_TOKEN_CAP=500000`)?
5. `deviceId` cookie lifetime: long-lived (~1 year) HttpOnly SameSite=Lax as stated in REQ-4?
6. REQ numbering: import reported complete (REQ-1..8, no gaps) — confirm leave as-is?
