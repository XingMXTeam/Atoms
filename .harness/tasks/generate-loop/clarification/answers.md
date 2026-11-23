# Clarification answers — generate-loop

Source of truth: `docs/plan/decisions.md` + `docs/plan/implementation_plan.md` (product owner approved 2026-11-23). Packet instruction: owner unavailable overnight; do not ask interactive questions; record minor resolved assumptions.

| Q | Answer (owner-approved / assumption consistent with decisions) |
|---|---|
| 1 | Workbench lives at `/projects/[projectId]` (App Router). Submit creates project+run then navigates there. |
| 2 | Exact ids are env-configurable: `GEMINI_MODEL_FLASH` (Planner/Architect) and `GEMINI_MODEL_PRO` (Engineer). Defaults documented in `.env.example` as currently available Flash/Pro-class ids; no hard-code of a single revision in product UI. (D5 + PRD REQ-8) |
| 3 | F2 ships a file tree + read-only source viewer (sufficient for REQ-5). CodeMirror / richer editors wait for polish / later features — not required by F2 PRD. |
| 4 | On SSE disconnect: mark run `interrupted`, surface Chinese 「继续」. 「继续」 starts a fresh SSE continuation attempt for the same project/run context; full resume semantics are a **documented known limitation** (PRD REQ-9 / implementation_plan §3). |
| 5 | ≥4 Chinese example prompt cards covering common small apps (e.g. 待办清单 / 番茄钟 / 计算器 / 天气卡片). Clicking a card fills the central prompt. |
| 6 | Yes — keep REQ-1..10 numbering; do not rewrite the imported PRD. |
