# TASK-5 developer report

- **Task:** Seed completed examples and cover version journeys with mock E2E
- **Commit:** `8d8813e`
- **Files:** `src/lib/db/repository.ts`, `src/lib/db/repository.test.ts`, `src/app/page.tsx`, `e2e/iterate-versions.spec.ts`, `e2e/generate-home.spec.ts`, `src/lib/llm/modes/mock.ts`, `src/app/api/projects/[projectId]/runs/[runId]/continue/route.ts`, `src/app/api/projects/[projectId]/versions/route.ts`, `src/components/workbench/workbench-client.tsx`, `src/middleware.ts`
- **Checks:**
  - `pnpm exec vitest run src/lib/db` — 2 files passed, 11 tests passed.
  - `LLM_PROVIDER=mock pnpm exec playwright test e2e/iterate-versions.spec.ts` — 2 passed.
  - `fh verify` — typecheck / lint / unit / build / e2e all green.
- **Implementation:**
  - Added idempotent `ensureSeedProjects` that inserts two completed example projects (待办清单示例 / 专注计时器示例) with version snapshots and QA scores when a device home is empty.
  - Home page calls seeding before listing projects so first paint is never a blank grid.
  - Extended the mock iterate E2E to cover follow-up → second version → rollback restores prior preview/code, plus a fresh-device seeded-home case.
  - Supporting journey plumbing: continue route accepts a follow-up prompt, mock LLM emits a priority-label delta, versions GET returns current files for client hydration, workbench avoids overwriting completed snapshot files during live stream, middleware forwards minted `deviceId` into the request cookie jar for SSR seed.
- **Contract decisions:** Seeding is skipped when the device already has any project. Generate-home E2E now asserts the two seeded cards instead of the empty-state copy.
