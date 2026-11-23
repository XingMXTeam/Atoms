# Browser case results — generate-loop, confirmation cycle 2

Run: `pnpm exec playwright test e2e/generate-*.spec.ts` against the built app with `LLM_PROVIDER=mock`; 11 tests passed, 0 failed. Independently recorded by `fh verify`: `e2e` passed at HEAD `0e436d5`.

| Case | Result | Evidence |
|---|---|---|
| E2E-1 | PASS | `e2e/generate-core.spec.ts`; preview painted, mock marker visible, sandbox is `allow-scripts`; `.harness/tasks/generate-loop/evidence/c2-confirm-20261123/workbench-preview.png` |
| E2E-2 | PASS | `e2e/generate-timeline.spec.ts`; Chinese Planner/Architect/Engineer cards and expandable Planner payload; `.harness/tasks/generate-loop/evidence/c2-confirm-20261123/workbench-timeline.png` |
| E2E-3 | PASS | `e2e/generate-timeline.spec.ts`; abort hook produced `interrupted` + `继续`; completed run hid recovery chrome; `.harness/tasks/generate-loop/evidence/c2-confirm-20261123/workbench-interrupted.png` |
| E2E-4 | PASS | `e2e/generate-submit.spec.ts`; empty/whitespace prompt keeps submit disabled and does not navigate |
| E2E-5 | PASS | `e2e/generate-home.spec.ts`; first example fills prompt; `.harness/tasks/generate-loop/evidence/c2-confirm-20261123/example-filled.png` |
| E2E-6 | PASS | `e2e/generate-persistence.spec.ts`; after hard refresh, Planner-derived title and project link remain |
| E2E-7 | PASS | `e2e/generate-preview.spec.ts`; Code file tree/source, return to painted preview, `allow-scripts` only; `.harness/tasks/generate-loop/evidence/c2-confirm-20261123/workbench-code.png` |
| E2E-8 | PASS | `e2e/generate-persistence.spec.ts`; clean context mints `deviceId`, project remains hidden from a second browser context |

No cases were skipped. The matching `fh verify` record is in `.harness/verify/last.json` (all five checks passed at current HEAD `0e436d5`).
