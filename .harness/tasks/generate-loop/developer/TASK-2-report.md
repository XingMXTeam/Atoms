# TASK-2 report — SSE agent pipeline + repository persistence for events/versions

## Status

done

## Commit

`3b56b93` — feat(TASK-2): SSE agent pipeline + repository persistence for events/versions

## What changed

- `src/lib/agents/{events,planner,architect,engineer,pipeline,fixtures}.ts` — ordered Planner→Architect→Engineer pipeline, SSE encode/parse, mock fixtures.
- `src/lib/agents/*.test.ts` — seq/SSE helpers + pipeline persistence/retry coverage.
- `src/lib/db/repository.ts` (+ `repository.events.test.ts`, exports) — `appendAgentEvent`, `listAgentEvents`, `createVersion`, `setCurrentVersion`, `getRun`, `listMessages`, `updateProjectTitle`.
- `src/lib/llm/model-routing.ts` (+ tests), `env.ts`, `.env.example` — `GEMINI_MODEL_FLASH` / `GEMINI_MODEL_PRO` routing.
- `src/lib/llm/modes/{mock,replay,gemini}.ts` — stage-specific structured JSON fixtures; Flash/Pro model id wiring in gemini shell.
- `src/app/api/projects/[projectId]/runs/[runId]/stream/route.ts` — SSE stream that runs the pipeline and persists events.

## Checks (fresh)

- `pnpm exec vitest run src/lib/agents src/lib/db src/lib/llm` → 6 files / 19 passed / 0 failed
- `pnpm typecheck` → pass
- `rg -n "GEMINI_MODEL_FLASH|GEMINI_MODEL_PRO" .env.example` → lines 15–16 present

## Decisions within contract

- Mock/replay return JSON fixtures keyed by `stage` so the pipeline can parse without live Gemini.
- Engineer parse failure retries exactly once (REQ-8).
- On Engineer success: version row + `current_version_id` + agent summary message + run `completed`.
- Stream marks abort as `interrupted`; mid-run reconnect without 「继续」 does not double-fire (known limitation; UI in TASK-3).
- Project title updated from Planner `title` after plan stage.

## Not done (out of scope)

- Timeline UI / 「继续」 affordance (TASK-3).
- Preview / 代码 tabs (TASK-4).
- Full e2e journeys (TASK-5).
