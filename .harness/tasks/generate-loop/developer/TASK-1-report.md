# TASK-1 report — Home prompt, example cards, and 我的项目 grid

## Status

done

## Commit

`6409e80` — feat(TASK-1): Home prompt, example cards, and 我的项目 grid

## What changed

- `src/app/page.tsx` — home now renders prompt form + 我的项目 grid (device-scoped).
- `src/components/home/prompt-form.tsx` — central prompt + submit → `POST /api/projects` → navigate workbench.
- `src/components/home/example-cards.tsx` — ≥4 Chinese example prompts that fill the input.
- `src/components/home/project-grid.tsx` — empty state + project links.
- `src/app/api/projects/route.ts` — create project + running run + user message; rate-limit gate.
- `src/app/projects/[projectId]/page.tsx` — workbench stub shell (timeline/preview later).
- `src/lib/db/repository.ts` (+ tests/exports) — `listProjects`, `createRun`, `updateRun`, `addMessage`.
- `e2e/generate-home.spec.ts`, `e2e/generate-submit.spec.ts` — REQ-1/REQ-2 Playwright coverage.

## Checks (fresh)

- `pnpm typecheck` → pass
- `pnpm exec vitest run src/lib/db/repository.test.ts` → 4 passed / 0 failed
- `pnpm exec playwright test e2e/generate-home.spec.ts e2e/generate-submit.spec.ts` → 4 passed / 0 failed

## Decisions within contract

- Example cards: 待办清单 / 番茄钟 / 计算器 / 天气卡片 (clarification Q5).
- Empty/whitespace prompt keeps 「开始生成」 disabled (E2E-4).
- Project title is a truncated prompt until Planner updates it in later tasks.
- Workbench is a stub shell only; timeline/preview belong to TASK-3/TASK-4.

## Not done (out of scope)

- SSE pipeline, agent timeline, preview/code panes, version persistence.
