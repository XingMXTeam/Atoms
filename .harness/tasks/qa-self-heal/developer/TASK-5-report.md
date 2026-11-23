# TASK-5 developer report

- Commit: `5eed925` (`feat(TASK-5): Persist score badges and verify mock recovery journeys`)
- Changed files:
  - `src/lib/db/repository.ts` exposes the current version's persisted QA score on project reads.
  - `src/app/projects/[projectId]/page.tsx` and `src/components/workbench/qa-timeline-card.tsx` show the workbench score badge; `src/components/home/project-grid.tsx` shows the persisted score on project cards.
  - `src/lib/agents/pipeline.ts`, `src/lib/llm/modes/mock.ts`, and `src/components/workbench/agent-timeline.tsx` provide a deterministic mock compile-error recovery journey and update the preview with repaired files.
  - `src/lib/db/repository.events.test.ts` and `e2e/qa-self-heal.spec.ts` cover score persistence, repair history, preview recovery, and the home card badge.
- Checks:
  - `pnpm exec vitest run src/lib/agents/pipeline.test.ts src/lib/db/repository.events.test.ts` -> 2 files passed, 8 tests passed.
  - `LLM_PROVIDER=mock pnpm exec playwright test e2e/qa-self-heal.spec.ts` -> 2 tests passed.
  - `fh verify` -> typecheck, lint, unit, e2e, and build all passed; unit: 18 files / 55 tests; E2E: 15 tests.
- Root cause: the run route does not provide a live preview probe, so the pipeline fallback treated the mock compile-error fixture as healthy. The deterministic fixture now marks its intentional compile error for the fallback probe, and the repair event carries the merged file set so the workbench can rebuild the preview.
- Decisions: the recovery trigger is the prompt phrase `触发修复演示`; it uses the existing mock provider and adds no dependency.
- Outstanding issues: none.
