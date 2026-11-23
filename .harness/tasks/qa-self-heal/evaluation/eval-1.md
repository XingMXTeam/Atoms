# Evaluation — qa-self-heal, cycle 1 (evaluate)

Tools: Playwright 1.65.1; harness capture run `c1-1` (FAIL, 1/2 pages); isolated QA spec (2/2 passed, one worker); manual browser screenshots and DOM inspection at 1280×800.

## E2E cases

| case | category | blocking | result | evidence |
|---|---|---:|---|---|
| E2E-1 | core | yes | FAIL | `evidence/c1-2/preview-dom-check.json`, `preview-dom-check.png`: the repaired run reports 100 and preview `ready`, but iframe body text is empty and the rendered pane is blank. |
| E2E-2 | core | yes | PASS | `evidence/c1-2/workbench-qa-expanded-ready.png`, `final-browser-results.json`: all three AC verdicts/reasons and a 100-point score are visible. |
| E2E-3 | negative | yes | SKIP | No documented mock control or public API configures a persistent failure through three repairs; could not trigger the exhausted path without inventing test setup. |
| E2E-4 | negative | yes | PASS | `evidence/c1-2/browser-results.json`: malformed probe message from the host window (not the active iframe source) did not add a probe event. |
| E2E-5 | boundary | no | PASS | `evidence/c1-2/final-browser-results.json`: repair resolved the failure in round 1; no unnecessary second repair appeared. |
| E2E-6 | persistence | yes | PASS | `evidence/c1-2/workbench-qa-expanded-ready.png`, `home-project-card-score-visible.png`, `final-browser-results.json`: 100-point score appears on the workbench and on the home card after navigation and reload. Run/version row equality was not directly inspectable because no read contract is documented. |
| E2E-7 | uiJourney | yes | PASS | `evidence/c1-2/workbench-qa-expanded-ready.png`: expanded card shows each criterion's failed reason, successful verdict, and round 1 resolution. The exhaustion branch is untested (see E2E-3). |
| E2E-8 | crossFeature | no | PASS | `evidence/c1-2/workbench-qa-expanded-ready.png`, `final-browser-results.json`: Planner, Architect, Engineer, probe, verdict, and fix history appear in the same timeline. |

The feature-specific Playwright spec passed 2/2 when run serially: `LLM_PROVIDER=mock pnpm exec playwright test e2e/qa-self-heal.spec.ts --workers=1`. The recorded full `fh verify` E2E check failed: 11 of 15 suite cases failed under five workers, including both QA cases timing out and several shared generation journeys observing an empty prompt or disabled submit button. `fh verify` recorded passing checks `typecheck`, `lint`, `unit`, and `build` at HEAD `5eed925`; E2E was recorded failed at that same HEAD. The run is in `.harness/verify/last.json` and `.harness/verify/e2e.log`.

## Rubric (judge items)

| id | layer | level | score | reason | artifacts |
|---|---|---|---:|---|---|
| RB-2 | L4-interaction | important | 1 | Chinese probe events are visible in the existing timeline. | `evidence/c1-2/workbench-qa-expanded-ready.png` |
| RB-4 | L4-interaction | important | 1 | Per-AC verdicts, reasons, and score are easy to inspect. | `evidence/c1-2/workbench-qa-expanded-ready.png` |
| RB-8 | L4-interaction | important | 0 | The exhausted state and visible three-round limit were not exercised; no deterministic exhaustion setup is documented. | `evidence/c1-2/workbench-qa-expanded-ready.png` |
| RB-10 | L4-interaction | important | 1 | Probe, verdict, fix, and follow-up judgment appear in sequence with a completed status. | `evidence/c1-2/workbench-qa-expanded-ready.png` |
| RB-12 | L3-ui | essential | 0.5 | Matching scores are visible and persist, but the workbench score is inside the QA timeline card rather than a separate header badge. | `evidence/c1-2/workbench-qa-expanded-ready.png`, `home-project-card-score-visible.png` |
| RB-14 | L4-interaction | important | 1 | Expanded history identifies each failed criterion's reason and resolution round. | `evidence/c1-2/workbench-qa-expanded-ready.png` |
| RB-16 | L4-interaction | important | 0 | The preview pane is blank even though QA reports a healthy result and the pane says `ready`. | `evidence/c1-2/preview-dom-check.png`, `preview-dom-check.json` |
| RB-17 | L2-robustness | pitfall | 1 | The malformed message from an unexpected source did not become a probe event. | `evidence/c1-2/browser-results.json` |
| RB-18 | L3-ui | pitfall | 1 | The score is accompanied by the QA verdict and repair history. | `evidence/c1-2/workbench-qa-expanded-ready.png`, `home-project-card-score-visible.png` |
| RB-21 | L4-interaction | pitfall | 1 | The completed score has inspectable per-criterion verdict and round history. | `evidence/c1-2/workbench-qa-expanded-ready.png` |

Judge-only layer averages: L2 100% (1/1); L3 75% (1.5/2); L4 71.4% (5/7). These exclude deterministic rubric items, which are handled by the harness evaluator.

## Comparison with references

| dimension | reference | ours | gap | fix | rubric id |
|---|---|---|---|---|---|
| Workbench | REF-1 | The two-pane layout and Chinese timeline extend the existing workbench, and QA history is expandable. | The preview remains blank while the QA state says it is healthy; the score also sits in the timeline card instead of a separate header badge. | Make the preview render non-empty content before reporting healthy; place the score in the specified workbench header. | RB-12, RB-16 |
| Home project card | REF-1 | A persisted `100 分` badge is visible on the project card after returning home and reloading. | No material score-card gap observed at 1280×800. | Keep the visible badge value synchronized with persisted run/version scores. | RB-12 |

## Page inspection

- **Home `/`**: centered Chinese heading establishes hierarchy; the prompt is the primary control; four examples are grouped in a two-column grid; project cards sit below with the score badge. Zinc borders and restrained gray text match the vision. The measured body width is 1280 px with no page-level horizontal overflow. The first harness screenshot has a project-empty state because no project existed in that context; the same-context journey screenshot shows the completed card.
- **Workbench `/projects/[projectId]`**: title/status precede the two-pane timeline and preview. Timeline cards are consistently aligned, grouped, and legible; expanded AC rows show reasons and round links. At 1280 px the measured QA card has no clipped text and the document has no horizontal overflow. The preview pane is visually blank. Browser inspection found the `about:srcdoc` frame had empty body text and six elements while its host reported `data-preview-status="ready"`.

## Exploratory findings

| id | probe | result | severity | add as E2E case? | evidence |
|---|---|---|---|---|---|
| X-1 | Rapid double submit | Double-click followed one project navigation and one run; no duplicate submission was observed. | info | no | `evidence/c1-2/browser-results.json` |
| X-2 | Long input (1,250 Unicode code units with emoji and RTL text) | The prompt accepted the text without a browser error; it was cleared before generation. | info | no | `evidence/c1-2/browser-results.json` |
| X-3 | Return home and reload after completion | The project card and 100-point badge remained visible after reload. | info | no | `evidence/c1-2/home-project-card-score-visible.png`, `final-browser-results.json` |

## Findings

| heuristic | artifact | severity | problem | recommendation | rubric id |
|---|---|---|---|---|---|
| H-PR-1.1 | `evidence/c1-2/preview-dom-check.png`, `preview-dom-check.json` | major | QA reports successful repair and the pane reports `ready`, while the iframe contains no visible content. | Rebuild or probe until the iframe has rendered content; report blank-screen failure instead of a passing score. | RB-16 |
| H-UX-2.3 | `evidence/c1-2/preview-dom-check.png` | major | The final visible result says 100 and complete despite the blank preview. | Keep the run in a recoverable failure state when the preview is blank. | RB-16 |
| H-UX-2.4 | `.harness/verify/e2e.log` | major | The full five-worker E2E run failed 11 of 15 tests, including both QA journeys; serial execution of the QA spec passes. | Isolate browser/database state across workers or serialize stateful generation journeys, then rerun the complete suite. | RB-10 |
| H-UI-7.1 | `evidence/c1-2/workbench-qa-expanded-ready.png` | minor | The workbench score appears inside the QA timeline card rather than as a separate header badge. | Put the same persisted score badge in the workbench header and keep the detailed score in the QA card. | RB-12 |

## Rubric refinement suggestions

| item | type | problem | suggestion |
|---|---|---|---|
| RB-8 | add-verification | Persistent failure and exhaustion cannot be configured from a documented mock interface. | Add a deterministic persistent-failure scenario that proves three rounds, no fourth repair, Chinese exhaustion status, and retained score/version. |
| RB-12 | add-verification | Run/version score equality is not checkable from a documented read path. | Document a read-only route or deterministic check comparing run, version, and project-card scores. |
| RB-16 | refine | `ready` and passing QA can coexist with an empty iframe. | Require non-empty visible preview content after recovery, alongside the ready state and repair history. |
| API contract | add-verification | No standalone QA API request/response and error contract is documented. | Document read/write paths, successful response shapes, malformed-input behavior, and permission behavior where applicable. See `api-1.md`. |
