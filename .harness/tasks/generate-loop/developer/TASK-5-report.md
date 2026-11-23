# TASK-5 report — Mock e2e core+persistence journeys and verify green

## Status

done

## Commit

`e76120c` — feat(TASK-5): Mock e2e core+persistence journeys and verify green

## What changed

- `e2e/generate-core.spec.ts` — REQ-10 / E2E-1: example-card fill → generate → Planner/Architect/Engineer completion → non-blank preview srcdoc with mock markers; CDN audit.
- `e2e/generate-persistence.spec.ts` — REQ-10 / E2E-6: after completed mock generate + hard refresh, 「我的项目」 lists Planner title `中文待办清单`; E2E-8 deviceId scoping across fresh browser context.
- `eslint.config.mjs` — ignore `.harness/**` and `public/preview/vendor/**` so lint does not scan harness evidence or vendored React ESM.
- `src/components/workbench/agent-card.tsx` — remove impure `Date.now()` during render (parent `now` tick only).
- `src/components/workbench/agent-timeline.tsx` — move `onFiles` ref sync into effect; hydrate interrupted message via initial state; defer EventSource `connect` with `setTimeout(0)` to satisfy `react-hooks/set-state-in-effect`.
- `src/components/workbench/preview-pane.tsx` — derive empty/loading from `files` + async bundle result identity instead of sync `setState` in effect.

## Checks (fresh)

- `pnpm typecheck` → pass
- `pnpm lint` → pass (0 errors / 0 warnings)
- `pnpm test` → 14 files / 43 passed / 0 failed
- `pnpm test:e2e` (`LLM_PROVIDER=mock`) → 12 passed / 0 failed
- `pnpm build` → pass

## root cause

`pnpm lint` failed because ESLint scanned self-hosted preview vendor React bundles plus React 19 purity rules flagged workbench `Date.now()` / sync effect `setState`; ignoring vendor+harness and small purity refactors made lint green without changing journey behavior.

## Decisions within contract

- Persistence assertion uses mock Planner fixture title (`中文待办清单`) already written by `updateProjectTitle` in the pipeline.
- Core journey prefers an example card then submit (covers E2E-5 fill path while exercising E2E-1).
- Playwright config already forces `LLM_PROVIDER=mock`; no config change required.

## Not done (out of scope)

- Rubric evaluation / `harness eval` (evaluator).
- QA self-heal (F3).
