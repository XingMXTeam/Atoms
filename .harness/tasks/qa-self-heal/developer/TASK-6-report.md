# TASK-6 developer report

## Changes

- `e2e/qa-self-heal.spec.ts`: Added a persistent-failure journey that asserts the three repair rounds, the exhausted Chinese state, a 0 score on the workbench, and the same score on the project card after returning home and reloading.
- `src/lib/llm/modes/mock.ts`: Added a deterministic persistent-failure mock prompt. Each repair changes the source delta while preserving the compile error, allowing the delta-only repair pipeline to reach its three-round cap.
- `src/lib/agents/pipeline.test.ts`: Asserted the persisted project/current-version score matches the persisted run score after exhaustion.

## Verification

- `LLM_PROVIDER=mock pnpm exec playwright test e2e/qa-self-heal.spec.ts --workers=5` — passed, 3 tests.
- `pnpm exec vitest run src/lib/agents src/lib/db` — passed, 5 files and 19 tests.
- `pnpm build` — passed. Next.js reported existing middleware deprecation and SQLite filesystem tracing warnings.

## Root cause

The first persistent-failure mock repair returned the same file content as the previous attempt. The delta-only repair path rejects unchanged files (`Engineer repair did not change any files`), ending the run after one attempt. Numbered retry comments make each delta distinct while retaining the mock compile-error marker.

## Decisions and limits

The UI journey verifies three visible repair events and the exhausted event. The pipeline unit test verifies exactly three repair calls and no fourth call, and compares the persisted run score with the current version score returned by the project repository. No production route or dependency was added.

## Commit

`f6f1af0` — `feat(TASK-6): Cover QA exhaustion and parallel journeys`

## Remediation: RB-8, RB-12, RB-16

- **RB-8 root cause:** The mock's persistent-failure prompt prefix existed only as an implicit string match, so the deterministic exhaustion control was not clearly documented. The test now names `MOCK_PERSISTENT_FAILURE_TRIGGER` and explains the prompt prefix beside the persistent-failure journey; focused unit coverage verifies three distinct failed repair outputs.
- **RB-12 root cause:** The live score badge was rendered inside the expandable QA card. The latest streamed verdict score now updates a separate badge beside workbench run status, and the persisted score initializes the same header badge after reload.
- **RB-16 root cause:** The repair-demo mock emitted only `src/App.tsx`, without an entry file that calls `createRoot`; esbuild therefore generated a bundle without mounting the app into the iframe root. The fixture now retains `src/main.tsx` across the repair delta, and E2E asserts that the opaque iframe paint beacon reports visible title text.
- **Verification:** `pnpm exec vitest run src/lib/llm/modes/mock.test.ts src/components/workbench/agent-timeline.test.tsx src/components/workbench/qa-timeline-card.test.tsx src/lib/preview/bundle.test.ts src/lib/agents/pipeline.test.ts` — 5 files, 11 tests passed. `pnpm typecheck` — passed. `pnpm lint` — passed with one existing `_url` unused warning. Browser E2E was not run by the developer role.
- **Commit:** `674253f` — `fix(RB-8 RB-12 RB-16): repair preview journey and score placement`

## Remediation: RB-8, RB-12, RB-16 (macro cycle 3)

- **RB-8 root cause:** The browser journey only asserted visible rounds and exhausted copy; it did not reload the workbench to inspect the persisted run row or establish the final version belongs to the same run. The workbench now reads current-version and run records from the repository and exposes their persisted QA values as score-badge attributes. The journey reloads and asserts exactly three persisted rounds, run score 0, version score 0, and matching run/version ids. Pipeline coverage asserts exactly three Engineer repair calls and confirms the persisted version score.
- **RB-12 root cause:** The home badge and workbench badge reflected project/live state, while no browser-visible contract identified the stored run and version scores. The reloaded workbench now reflects both database rows; recovery E2E asserts both equal 100, then confirms the home badge remains 100 after reload. Repository tests cover direct version-row reads.
- **RB-16 root cause:** The paint beacon relied on a five-second polling window, which could miss delayed React content during parallel browser load. It now observes root mutations and retains a 30-second polling fallback. A reloaded workbench renders the saved version files, and E2E asserts the repaired preview is painted after reload. The reported failure did not reproduce in the initial local full-suite run; the final focused and full parallel runs both passed.
- **Verification:** `pnpm exec vitest run src/lib/agents/pipeline.test.ts src/lib/db/repository.events.test.ts src/components/workbench/agent-timeline.test.tsx src/components/workbench/qa-timeline-card.test.tsx src/lib/preview/bundle.test.ts` — 5 files, 13 tests passed. `pnpm typecheck` — passed. `pnpm build` — passed (existing middleware deprecation and SQLite tracing warnings). `pnpm lint` — 0 errors, 1 existing unused `_url` warning. `LLM_PROVIDER=mock pnpm exec playwright test e2e/qa-self-heal.spec.ts --workers=5` — 3 passed. `LLM_PROVIDER=mock pnpm exec playwright test --workers=5` — 16 passed.
- **Commit:** `24a856c` — `fix(RB-8 RB-12 RB-16): expose persisted QA state and stabilize paint`
