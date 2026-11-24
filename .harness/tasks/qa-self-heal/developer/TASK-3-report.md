# TASK-3 developer report

- Implemented QA probe/verdict/fix sequencing, focused repair requests, file-delta merging, a strict three-repair cap, and preservation of final score/version when exhausted.
- Persisted `qaRounds` and `qaScore` on the run and the final score on the version; mock and replay providers now support repair responses.
- Commit: `f02c1e2` (`feat(TASK-3): Implement delta-only self-heal loop with three-round cap`).
- Tests: `pnpm exec vitest run src/lib/agents src/lib/preview` → 7 test files passed, 22 tests passed.
- Typecheck: `pnpm typecheck` → passed (`tsc --noEmit`, exit 0).
- Decisions within contract: round count increments immediately before each Engineer repair call; after three repairs the fourth failing QA judgment emits `已达修复上限`, stores the last score/version, and makes no fourth repair call. Repairs are filtered against current paths/content before merge, so unchanged files are discarded.
- Limitation: the pipeline accepts a fresh `probePreview` callback, but the existing SSE route does not yet provide browser-backed preview reports; calls without that callback use the pipeline's fallback report. Wiring the browser probe lifecycle remains necessary for end-to-end self-heal behavior.
