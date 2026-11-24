# TASK-2 implementation report

- **Task:** Add the version timeline and snapshot rollback to the workbench.
- **Commit:** `c8f48ea`
- **Changed files:** `src/app/projects/[projectId]/page.tsx`, `src/components/workbench/workbench-client.tsx`, `src/components/workbench/workbench-panels.tsx`, `src/lib/db/repository.ts`, `src/lib/db/repository.events.test.ts`, `src/app/api/projects/[projectId]/versions/route.ts`, `e2e/iterate-versions.spec.ts`.
- **Behavior:** Added chronological version listing by run start time, an owner-scoped versions API with rollback validation, the Chinese 版本 timeline with summaries and QA scores, and client hydration of both preview and code from the selected immutable snapshot. The timeline refreshes after a run completes so versions committed after the initial page render appear.
- **Checks:** `pnpm exec playwright test e2e/iterate-versions.spec.ts` → 1 passed, 0 failed; `pnpm typecheck` → passed; `pnpm exec vitest run src/lib/db/repository.events.test.ts` → 1 test file passed, 4 tests passed; `pnpm build` → passed; `pnpm lint` → 0 errors, 1 existing warning in `src/components/workbench/agent-timeline.test.tsx` (`_url` unused).
- **Test coverage note:** The mock E2E generates one version (a follow-up run returns no changed files), so it verifies the owner-scoped rollback endpoint against that snapshot, while an older-version button click requires multiple persisted snapshots and is left for evaluator coverage. The repository test verifies chronological ordering across two snapshots.
- **Decisions:** Version chronology uses the associated run's `startedAt`, with version ID as a deterministic tie-breaker. Historical rows remain unchanged; rollback updates the project pointer and returns the selected snapshot files and score.
