# Clarification answers — foundation

Source of truth: `docs/plan/decisions.md` + `docs/plan/implementation_plan.md` (product owner approved 2026-11-23). Packet instruction: owner unavailable overnight; do not ask interactive questions; record minor resolved assumptions.

| Q | Answer (owner-approved / assumption consistent with decisions) |
|---|---|
| 1 | Prefer degrade to `replay` with clear Chinese 「演示回放」 label (D11). Refuse with a clear Chinese message only when replay cannot run. |
| 2 | Polished calm Chinese product home — professional, restrained, high design quality (D8). Not a pixel copy of Atoms. |
| 3 | better-sqlite3 (already a dependency; matches REQ-3 wording). |
| 4 | Yes — defaults match `.env.example` / implementation plan: `DEVICE_DAILY_RUN_LIMIT=20`, `DAILY_TOKEN_CAP=500000`. |
| 5 | Yes — long-lived (~365 days) HttpOnly, SameSite=Lax, path `/`. |
| 6 | Yes — keep REQ-1..8 numbering; do not rewrite the imported PRD. |
