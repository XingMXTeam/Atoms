# TASK-3 report — Workbench Agent timeline + interrupt 继续 affordance

## Status

done

## Commit

feat(TASK-3): Workbench Agent timeline + interrupt 继续 affordance (SHA recorded by `harness task-done`)

## What changed

- `src/components/workbench/agent-timeline.tsx` — SSE consumer, Chinese Agent timeline, interrupt → 「继续」.
- `src/components/workbench/agent-card.tsx` (+ unit test) — status / elapsed / expandable payload cards.
- `src/app/projects/[projectId]/page.tsx` — mounts timeline with run status from repository.
- `src/app/api/projects/[projectId]/runs/[runId]/continue/route.ts` — 「继续」 creates a fresh run (known limitation: not checkpoint resume).
- `src/app/api/projects/[projectId]/runs/[runId]/stream/route.ts` — optional `stageDelayMs` for interrupt e2e; REQ-9 comments.
- `src/lib/agents/pipeline.ts` (+ interrupt unit test) — stage delay + aborted → `interrupted`.
- `e2e/generate-timeline.spec.ts` — REQ-4 Chinese cards + REQ-9 interrupt/继续 journey.

## Checks (fresh)

- `pnpm exec playwright test e2e/generate-timeline.spec.ts` → 2 passed / 0 failed
- `rg -n "继续" src` → hits in timeline / continue / stream / pipeline
- `pnpm typecheck` → pass
- `pnpm exec vitest run src/lib/agents/pipeline.test.ts src/components/workbench/agent-card.test.tsx` → 4 passed / 0 failed

## Decisions within contract

- Chinese labels: 规划师 / 架构师 / 工程师; statuses 等待中 / 进行中 / 已完成 / 失败 / 已中断.
- 「继续」 POSTs continue API which starts a **new** run for the same project (documented known limitation).
- Test hook `window.__ATOMS_ABORT_SSE__` + optional `stageDelayMs` / localStorage delay let e2e force disconnect mid-run without new dependencies.
- Preview/code panes remain stubs (TASK-4).

## Not done (out of scope)

- Preview / 代码 tabs (TASK-4).
- Full core/persistence e2e journeys (TASK-5).
