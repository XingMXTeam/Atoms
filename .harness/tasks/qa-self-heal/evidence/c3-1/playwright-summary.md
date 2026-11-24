# Browser evidence summary — cycle 3

Browser: Chromium via Playwright 1.65.1; viewport 1280×800; provider `mock`.

## Commands and outcomes

- `LLM_PROVIDER=mock pnpm exec playwright test e2e/qa-self-heal.spec.ts --workers=1` — 3/3 passed.
- `LLM_PROVIDER=mock pnpm exec playwright test e2e/qa-self-heal.spec.ts` — 3/3 passed, 3 workers.
- `LLM_PROVIDER=mock pnpm exec playwright test e2e/generate-preview.spec.ts --workers=1` — 1/1 passed; preview iframe sandbox is exactly `allow-scripts` and painted content is visible.
- `fh verify` at HEAD `04d41e0` — recorded typecheck, lint, unit and build as passed; recorded E2E check failed (12 failures / 16 tests) at 5 workers. Failures included all three QA tests timing out or finding the submit button disabled, plus generate-loop journeys. The full-run failure is retained in `.harness/verify/e2e.log`; the isolated QA suite passes at 1 and 3 workers.

## Case matrix

| Case | Result | Evidence |
| --- | --- | --- |
| E2E-1 | PASS | QA compile-error recovery test; `workbench-expanded.png`; score and preview measurements in authenticated journey output summarized in `eval-3.md` |
| E2E-2 | PASS | QA timeline test checks per-criterion verdict/reason and integer score; `workbench-expanded.png` |
| E2E-3 | PASS | Exhaustion test; `workbench-exhaustion-top.png`, `workbench-exhaustion-details.png`; persisted rounds=3 and score=0 |
| E2E-4 | PASS | `message-probe.json`: malformed host and iframe messages left accepted probe and repair counts unchanged |
| E2E-5 | PASS | Recovery journey completed after the first fix; persisted `qa_rounds=1` |
| E2E-6 | PASS | Recovery test and home-after-reload score badge; `home-with-score.png` |
| E2E-7 | PASS | Expanded recovery and exhaustion history screenshots; both explain the criterion outcome and round |
| E2E-8 | PASS | Expanded QA timeline screenshot shows Planner/Architect/Engineer and ordered probe/verdict/fix events; unit verification passed |

The `fh verify` full-suite E2E failure is reported separately from the successful feature-specific browser cases; it remains a project-level finding against the QA concurrency expectation in RB-10.
