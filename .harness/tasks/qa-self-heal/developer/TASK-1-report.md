# TASK-1 — Validate sandbox preview probe reports

- Commit: `b82d0ab`
- Changed files: `src/components/workbench/preview-pane.tsx`, `src/lib/preview/bundle.ts`, `src/lib/preview/bundle.test.ts`, `src/lib/preview/probe.ts`, `src/lib/preview/probe.test.ts`
- Checks: `pnpm exec vitest run src/lib/preview` — 4 test files passed, 10 tests passed.
- Checks: `pnpm typecheck` — passed (`tsc --noEmit`, exit 0).
- Behavior: sandbox reports are validated with a strict bounded Zod schema and accepted only from the active iframe source. The iframe reports runtime errors, blank-screen state, and a bounded DOM summary. Preview compilation failures produce a bounded compile-error report through the host callback.
- Contract decisions: opaque sandbox origin means messages use `postMessage(..., "*")`; the host relies on active iframe source identity and payload validation. Text and error details are truncated/capped.
- Limitations: probe delivery is exposed through the optional `onProbeReport` callback; QA pipeline consumption is outside TASK-1.
