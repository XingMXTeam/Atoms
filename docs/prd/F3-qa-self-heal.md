# F3 — QA Self-Heal

After Engineer output, probe the preview, let QA judge each acceptance criterion, and auto-fix up to 3 rounds with a visible score badge.

## Requirements

- **REQ-1** Preview iframe posts a probe report to the host via `postMessage`: compile errors, runtime errors, blank-screen detection, and a DOM summary.
- **REQ-2** QA agent (Flash-class) receives the Planner acceptance criteria + probe report and emits per-criterion verdicts (`pass` / `fail` + reason) plus an overall `qa_score` (0–100).
- **REQ-3** Self-heal loop: if compile/runtime errors exist or any critical AC fails, QA emits a fix instruction; Engineer returns a patch (`files` delta only); preview rebuilds; QA re-judges. Hard cap **≤3** fix rounds per run (`runs.qa_rounds`).
- **REQ-4** Each QA / fix step is an `agent_events` row (`type`: `probe` | `verdict` | `fix` | `error`) streamed to the timeline UI.
- **REQ-5** Final `qa_score` is stored on the `runs` and `versions` rows and shown as a score badge on the workbench and project cards.
- **REQ-6** Timeline QA card expands to show per-AC verdicts and which fix round resolved (or exhausted) each failure.
- **REQ-7** E2E negative path with mock provider: force a compile error in first Engineer output → self-heal succeeds within ≤3 rounds → preview healthy and score badge visible.

## Non-goals

- Human-in-the-loop editing of generated files.
- Expanding beyond 3 fix rounds or unbounded token spend.
- Visual / screenshot-diff QA (DOM + error probe only for this feature).
- Share / zip / rollback (F4).

## Acceptance criteria

1. Mock negative e2e (`LLM_PROVIDER=mock`): first Engineer payload is intentionally broken → probe reports error → QA fails ≥1 AC → Engineer patch applied → final preview passes and `qa_score` ≥ configured mock threshold.
2. `runs.qa_rounds` never exceeds 3; a fourth failure path stops with a clear Chinese "已达修复上限" state and still persists the last version + score.
3. Score badge is visible on the completed workbench header and on the home project card after navigation.
4. Unit tests cover probe message validation (zod), verdict aggregation, and round-cap enforcement.
5. `fh verify` remains green with the new e2e included under the `e2e` check.
