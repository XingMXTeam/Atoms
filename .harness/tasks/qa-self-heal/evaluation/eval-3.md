# Evaluation — qa-self-heal, cycle 3 (confirm-evaluation)

Tools: Chromium / Playwright 1.65.1; `fh verify` recorded five passing checks at HEAD `04d41e0f5b6eeb1250094477ee7593bf0b2c83d0`; focused QA spec passed 3/3 at three workers. Capture run `c3-confirm-20261124` FAIL (1/2 pages). Real-browser exploration used mock provider at 1280×800 and saved fresh Home, recovery workbench, and exhaustion workbench screenshots.

## E2E cases

| case | category | blocking | result | evidence |
| --- | --- | --- | --- | --- |
| E2E-1 | core | yes | PASS | Focused mock compile-error recovery passed; screenshot shows repaired painted preview and 100-point score. `evidence/c3-confirm-20261124/e2e-run.md`, `evidence/c3-confirm-20261124/workbench-browser-journey.png` |
| E2E-2 | core | yes | PASS | QA card exposes per-criterion result/reason and overall score; timeline spec passed. `evidence/c3-confirm-20261124/e2e-run.md`, `evidence/c3-confirm-20261124/workbench-exhausted.png` |
| E2E-3 | negative | yes | FAIL | UI shows exactly three repair rounds and exhausted state with retained score, and focused spec passed, but the live workbench badge reported `data-run-qa-rounds="0"`. `evidence/c3-confirm-20261124/workbench-exhausted.png`, `evidence/c3-confirm-20261124/browser-checks.md` |
| E2E-4 | negative | yes | PASS | Sent a malformed message from the preview iframe and a report-shaped message from the host window; the QA timeline remained unchanged. `evidence/c3-confirm-20261124/browser-checks.md` |
| E2E-5 | boundary | no | PASS | The first repair resolved the recovery journey; the loop stopped after round 1 and did not issue another fix. `evidence/c3-confirm-20261124/e2e-run.md`, `evidence/c3-confirm-20261124/workbench-browser-journey.png` |
| E2E-6 | persistence | yes | PASS | Focused spec compared run/version scores and reloaded Home; both workbench and project card showed 100. `evidence/c3-confirm-20261124/e2e-run.md`, `evidence/c3-confirm-20261124/home-after-recovery.png` |
| E2E-7 | uiJourney | yes | PASS | Expanded history shows per-AC reasons and round 1 resolution; exhaustion screenshot shows each AC through exhausted round 3. `evidence/c3-confirm-20261124/workbench-browser-journey.png`, `evidence/c3-confirm-20261124/workbench-exhausted.png` |
| E2E-8 | crossFeature | no | PASS | `fh verify` E2E and the focused QA timeline run passed; existing generate-loop actors and QA events remain in one workbench timeline. `.harness/verify/e2e.log`, `evidence/c3-confirm-20261124/e2e-run.md` |

Focused direct run: 3/3 passed. `fh verify`: all five checks passed (`typecheck`, `lint`, `unit`, `e2e`, `build`). Blocking case with a live discrepancy: E2E-3. An earlier direct attempt reused a leftover capture development server and timed out; after stopping it and rebuilding, the isolated CI-mode focused spec passed. The invalid first attempt is excluded from the case results.

## Rubric (judge items)

| id | layer | level | score | reason | artifacts |
| --- | --- | --- | --- | --- | --- |
| RB-2 | L4-interaction | important | 1 | Probe, verdict, and repair events appear in Chinese and in order. | `evidence/c3-confirm-20261124/workbench-browser-journey.png`, `evidence/c3-confirm-20261124/e2e-run.md` |
| RB-4 | L4-interaction | important | 1 | Expanded QA history exposes criterion outcomes/reasons and score. | `evidence/c3-confirm-20261124/workbench-browser-journey.png`, `evidence/c3-confirm-20261124/workbench-exhausted.png` |
| RB-8 | L4-interaction | important | 0.5 | Three repairs and terminal state are visible, but persisted round metadata reports 0 in the live run. | `evidence/c3-confirm-20261124/workbench-exhausted.png`, `evidence/c3-confirm-20261124/browser-checks.md` |
| RB-10 | L4-interaction | important | 1 | Timeline ordering and status remain visible; focused E2E passed at three workers. | `evidence/c3-confirm-20261124/workbench-browser-journey.png`, `evidence/c3-confirm-20261124/e2e-run.md` |
| RB-12 | L3-ui | essential | 1 | Run/version/workbench/Home score consistency passed; 100-point badges are visible after reload. | `evidence/c3-confirm-20261124/workbench-browser-journey.png`, `evidence/c3-confirm-20261124/home-after-recovery.png`, `evidence/c3-confirm-20261124/e2e-run.md` |
| RB-14 | L4-interaction | important | 1 | History is scannable and explicitly connects criteria to round 1 resolution or round 3 exhaustion. | `evidence/c3-confirm-20261124/workbench-browser-journey.png`, `evidence/c3-confirm-20261124/workbench-exhausted.png` |
| RB-16 | L4-interaction | important | 1 | Mock compile error recovered in one round; preview painted repaired content and showed the final score. | `evidence/c3-confirm-20261124/workbench-browser-journey.png`, `evidence/c3-confirm-20261124/e2e-run.md` |
| RB-17 | L2-robustness | pitfall | 1 | Malformed and unexpected-source messages did not alter the QA timeline or trigger repair. | `evidence/c3-confirm-20261124/browser-checks.md` |
| RB-18 | L3-ui | pitfall | 1 | Score badge remains visually separate from the inspectable QA verdict and repair history. | `evidence/c3-confirm-20261124/workbench-browser-journey.png`, `evidence/c3-confirm-20261124/home-after-recovery.png` |
| RB-21 | L4-interaction | pitfall | 1 | Completed workbench score has inspectable per-criterion verdicts and round history in both recovery and exhaustion states. | `evidence/c3-confirm-20261124/workbench-browser-journey.png`, `evidence/c3-confirm-20261124/workbench-exhausted.png` |

## Comparison with references

| dimension | REF-n | ours | gap | fix | rubric id |
| --- | --- | --- | --- | --- | --- |
| Home hierarchy and restrained zinc styling | REF-1 | Centered title and prompt, aligned example cards, project score card | Close match: neutral zinc palette, clear title hierarchy, and a visible score badge on the completed project card. | None observed. | RB-12 |
| Workbench timeline and preview | REF-1 | Two-pane layout with Chinese Planner/Architect/Engineer/QA cards, clear status, expanded QA history, score at header | Matches the timeline structure and status-before-details intent. Recovery preview paints repaired content. On exhaustion, the preview pane remains at “正在打包预览…” although the run is terminal. | Show the last available preview/version state clearly when the run exhausts. | RB-14, RB-16 |
| Traceable score and repair history | REF-1 / RL-2 / RL-3 | Score badge sits apart from expandable per-AC history; each AC names resolution/exhaustion round | The history says three repairs while the live run-round attribute says zero; this breaks the audit trail for the persisted counter. | Keep `runs.qa_rounds` in sync with the visible repair events and assert equality after reload. | RB-8 |

## Page review

- **Home, initial empty state** (`evidence/c3-confirm-20261124/home-project-cards-qa-score.png`): the 36px title is the visual start point; the prompt is centered in a 672px column; four examples align in a two-column grid with restrained borders. The empty project state is expected before generation.
- **Home, completed project** (`evidence/c3-confirm-20261124/home-after-recovery.png`): same hierarchy and spacing; a project card shows the title and 100-point badge in the visible viewport. No clipped text or overlap was apparent.
- **Workbench, recovered run** (`evidence/c3-confirm-20261124/workbench-browser-journey.png`): balanced two-pane workspace, neutral colors, Chinese role labels, current status before details, and a 100-point header badge. Expanded QA events remain readable; the preview displays “我的待办 / 预览已修复”. The viewport measurement reported one overflow-heuristic node, but no visible clipped text or overlap was apparent.
- **Workbench, exhausted run** (`evidence/c3-confirm-20261124/workbench-exhausted.png`): full-page screenshot shows all three acceptance criteria and their failure reasons across rounds 0–3, plus the Chinese exhausted state and 0-point badge. The preview remains on a packing indicator after the terminal state. The badge’s `data-run-qa-rounds` was 0 even though the timeline visibly lists repair rounds 1, 2, and 3.
- **Official capture** (`evidence/c3-confirm-20261124/manifest.json`): failed overall (1/2 pages valid). Home produced a real PNG; workbench capture navigated to the literal `/projects/[projectId]` template in its fresh browser and timed out. No fallback was used. Separate same-context Playwright journeys created the project and produced the workbench screenshots above.

## Exploratory findings

| id | probe | result | severity | add as E2E case? | evidence |
| --- | --- | --- | --- | --- | --- |
| X-1 | Empty submit | Submit is disabled while empty; expected behavior. | info | no | `evidence/c3-confirm-20261124/browser-checks.md` |
| X-2 | Long input (1,205 code points, emoji, RTL) | Input remained within the textarea with no horizontal overflow. | info | no | `evidence/c3-confirm-20261124/browser-checks.md` |
| X-3 | Rapid repeated submit | Two near-simultaneous clicks produced one workbench and one completed journey. | info | no | `evidence/c3-confirm-20261124/browser-checks.md` |
| X-4 | Malformed/untrusted preview messages | Timeline did not change and no repair started. | info | no | `evidence/c3-confirm-20261124/browser-checks.md` |
| X-5 | Back/forward after completion | Back reopened the same project; forward returned Home with the persisted card visible. | info | no | `evidence/c3-confirm-20261124/browser-checks.md` |
| X-6 | Exhaustion counter consistency | Three visible repair events and exhausted terminal state coexisted with `data-run-qa-rounds="0"`. | major | yes | `evidence/c3-confirm-20261124/workbench-exhausted.png`, `evidence/c3-confirm-20261124/browser-checks.md` |

## Findings

| heuristic | artifact | severity | problem | recommendation | rubric id |
| --- | --- | --- | --- | --- | --- |
| H-PR-2.1 | `evidence/c3-confirm-20261124/workbench-exhausted.png` | major | The live exhausted workbench shows repair rounds 1–3 but reports `data-run-qa-rounds="0"` on the same score badge. | Persist the actual repair-attempt count and assert it matches the timeline after a fresh reload. | RB-8 |

## API checks

The tech design and PRD do not define concrete API request/response contracts, so no real API call was invented. See `evaluation/api-3.md`; the browser postMessage boundary was independently probed.

## Rubric refinement suggestions

| type | item | problem | suggestion |
| --- | --- | --- | --- |
| add-verification | RB-8 | The exhausted timeline showed three repairs while live run-round metadata was zero. | Assert persisted `runs.qa_rounds` equals the visible fix-event count after a fresh reload and that no fourth Engineer call occurs. |
| add-verification | RB-14 | Official capture cannot resolve the literal workbench template or establish a same-context project. | Create a project in the capture browser and follow its real workbench URL; require a successful PNG in the manifest. |
| add-verification | RB-17 | No deterministic check separately counts rejected probe, verdict, and fix events after malformed or unexpected-source messages. | Add explicit message-class checks asserting rejected inputs create no probe/verdict/fix event and do not invoke repair. |
| add-verification | RB-17 | API methods, payloads, malformed-message behavior, and ownership errors are unspecified. | Document these contracts and add real-request checks for valid, malformed, boundary, and wrong-deviceId cases. |
