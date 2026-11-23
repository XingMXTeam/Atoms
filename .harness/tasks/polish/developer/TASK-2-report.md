# TASK-2 developer report

- **Task:** Follow-up UX and complete empty/loading/error/replay states
- **Commit:** `b24a088`
- **Files:** `src/components/workbench/follow-up-form.tsx`, `src/components/workbench/follow-up-form.test.tsx`, `src/components/workbench/agent-timeline.tsx`, `src/components/workbench/workbench-client.tsx`, `src/components/home/prompt-form.tsx`, `src/app/projects/[projectId]/page.tsx`, `src/app/api/projects/[projectId]/runs/[runId]/continue/route.ts`, `e2e/polish.spec.ts`
- **Checks:**
  - `pnpm exec vitest run src/components/workbench/follow-up-form.test.tsx` — 1 passed.
  - `LLM_PROVIDER=mock pnpm exec playwright test e2e/polish.spec.ts --grep "follow-up|qa-rounds|演示回放|ux-states|follow-up-disabled|share-read-only"` — 6 passed.
  - `pnpm typecheck` — passed.
  - Note: Playwright uses `next start`, so `pnpm exec next build` was run before the green e2e pass.
- **Implementation:**
  - Added left-rail Chinese follow-up form (`后续需求` / `发送后续需求`) that POSTs `/continue` with a prompt; disabled while a run is active or pending; omitted from share (no workbench).
  - Continue API now applies rate-limit / replay degradation and returns `mode`/`label` so the workbench can show `演示回放`.
  - Workbench surfaces persisted `qa_rounds` metadata, `已达修复上限` when rounds ≥ 3, replay banner via `?provider=replay` or continue/create response label, interrupted `继续` banner, and existing preview empty/loading/compile-error states.
  - Home prompt form forwards replay mode into the workbench URL.
- **Contract decisions:** Follow-up reuses the existing `/continue` owner-scoped run API (no new endpoints). Preview width toggle left for TASK-3.
