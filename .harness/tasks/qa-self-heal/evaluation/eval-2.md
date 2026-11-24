# Evaluation — qa-self-heal, cycle 2 (evaluate)
Tools: Playwright 1.65.1; harness capture run c2-eval-1 (FAIL, 1/2 pages); same-context browser screenshots in evidence/c2-eval-2

## E2E cases

| case | category | blocking | result | evidence |
| --- | --- | --- | --- | --- |
| E2E-1 | core | yes | PASS (focused journey); full-suite run exposed intermittent paint failure | `.harness/verify/e2e.log`, `evidence/c2-eval-2/workbench.png` |
| E2E-2 | core | yes | PASS | Focused QA timeline journey asserted criterion, verdict and reason; `.harness/verify/e2e.log` |
| E2E-3 | negative | yes | PASS (UI exhaustion); no-fourth-call and DB row values not independently observed | `.harness/verify/e2e.log`, `evidence/c2-eval-2/home.png` |
| E2E-4 | negative | yes | PASS (host-window malformed/forged probe) | `evidence/c2-eval-2/browser-probes.json`; timeline text unchanged after both messages |
| E2E-5 | boundary | no | PASS | Focused recovery showed first repair resolved the compile failure; `.harness/verify/e2e.log` |
| E2E-6 | persistence | yes | PASS (visible persistence) | Home badge remained `100 分` after reload in `evidence/c2-eval-2/home-badges.json`; direct run/version equality not inspected |
| E2E-7 | uiJourney | yes | PASS | Focused test expanded QA history; recovery and exhaustion events shown in `evidence/c2-eval-2/workbench.png` and `.harness/verify/e2e.log` |
| E2E-8 | crossFeature | no | PASS (visible journey) | Timeline kept Planner, Architect, Engineer, and QA visible during the focused browser suite; `.harness/verify/e2e.log` |

The focused `pnpm exec playwright test e2e/qa-self-heal.spec.ts` passed 3/3. The project's recorded `fh verify` run at HEAD `674253f4a891c71c78ab7df4bf320c9d15b08457` passed `typecheck`, `lint`, `unit`, and `build`; its full E2E check failed 1/16. The failing test was the compile-error recovery journey: it observed `preview-status="ready"` while `preview-painted="false"` remained false. The other 15 cases passed.

## Rubric (judge items)

| id | layer | level | score | reason | artifacts |
| --- | --- | --- | ---: | --- | --- |
| RB-2 | L4-interaction | important | 1 | Chinese probe status is visible in order in the existing timeline. | `evidence/c2-eval-2/workbench.png` |
| RB-4 | L4-interaction | important | 1 | Expanded QA card exposes criterion verdicts and reasons with the score visible. | `evidence/c2-eval-2/workbench.png` |
| RB-8 | L4-interaction | important | 0.5 | Three repairs, Chinese exhausted state and retained visible score are shown; fourth-call absence and stored version row are not directly observable. | `evidence/c2-eval-2/workbench.png`, `home.png` |
| RB-10 | L4-interaction | important | 1 | QA events appear alongside existing agent progress; focused QA journeys passed in parallel. | `evidence/c2-eval-2/workbench.png`, `.harness/verify/e2e.log` |
| RB-12 | L3-ui | essential | 0.5 | Workbench and home badges match and survive reload, but equality with both persisted rows could not be checked from the browser contract. | `evidence/c2-eval-2/workbench.png`, `home.png`, `home-badges.json` |
| RB-14 | L4-interaction | important | 1 | Expanded history is ordered and associates the failure with its repair round or exhaustion. | `evidence/c2-eval-2/workbench.png`, `.harness/verify/e2e.log` |
| RB-16 | L4-interaction | important | 0.5 | Focused recovery produced a healthy painted preview, but the full parallel suite intermittently left the preview unpainted while reporting ready. | `evidence/c2-eval-2/workbench.png`, `browser-probes.json`, `.harness/verify/e2e.log` |
| RB-17 | L2-robustness | pitfall | 1 | Malformed and forged host-window probe messages did not alter the QA timeline. | `evidence/c2-eval-2/browser-probes.json` |
| RB-18 | L3-ui | pitfall | 1 | Score remains a distinct badge while verdicts and repair history are inspectable in the QA card. | `evidence/c2-eval-2/workbench.png`, `home.png` |
| RB-21 | L4-interaction | pitfall | 1 | Completed score has inspectable per-criterion history and visible repair/exhaustion rounds. | `evidence/c2-eval-2/workbench.png`, `.harness/verify/e2e.log` |

Per-layer judge averages: L2 1.00; L3 0.625; L4 0.846. No L1 judge items were included in this packet. The full E2E failure and essential RB-12 partial score prevent a clean evaluation pass.

## Comparison with references

| dimension | reference | ours | gap | fix | rubric id |
| --- | --- | --- | --- | --- | --- |
| Workbench layout and timeline | REF-1 | Two-pane Chinese workbench, restrained zinc styling, ordered expandable agent/QA cards | No material layout or hierarchy gap at 1280×800; one full-suite recovery run left preview blank after status became ready | Make preview-ready state wait for actual painted content and stable recovery under concurrency | RB-16 |
| Inspectable recovery | RL-3 | Expanded QA timeline shows verdicts, reasons, repair round and exhaustion | History is visible; intermittent blank preview weakens the completed result | Preserve the visible completion only after paint is confirmed | RB-14, RB-16, RB-21 |
| Probe trust boundary | RL-1 | Malformed and forged messages from host window did not add timeline events | No issue reproduced in browser probes | Keep boundary behavior | RB-17 |
| Bounded repair and retained result | RL-2 | UI shows three repairs, exhausted state and score after reload | Browser evidence cannot prove no fourth backend call or retained version row | Add deterministic call-count and repository persistence evidence | RB-8 |

The harness capture itself produced a real home screenshot but failed the workbench template route `/projects/[projectId]` because that route requires a project created in the same browser context. Following the page notes, I generated a project and captured the real workbench and home pages in a same-context Playwright session (`evidence/c2-eval-2`). No fallback capture was used. Both screenshots were opened and inspected. At 1280×800, the workbench has a clear title/status/score hierarchy, consistent card alignment, no horizontal overflow, and no prominent contrast or spacing defects; the QA history is compact and scannable. The home page clearly separates the prompt, examples, and project list, and its persisted score badge is visible. The browser measurement found one horizontally clipped descendant on the workbench; it did not create page-level horizontal overflow.

## Exploratory findings

| id | probe | result | severity | add as E2E case? | evidence |
| --- | --- | --- | --- | --- | --- |
| X-1 | Rapid repeated submit | Two rapid clicks navigated to one workbench and produced one visible project result. | info | no | `evidence/c2-eval-1/home-project-cards-qa-score.png` |
| X-2 | Malformed/forged probe message from host window | Timeline text did not change after either message. | info | no | `evidence/c2-eval-2/browser-probes.json` |
| X-3 | Back/forward and reload mid-flow | Home card retained `100 分` after reload; back/forward returned between the same workbench and home. | info | no | `evidence/c2-eval-1/exploratory.json`, `evidence/c2-eval-2/home-badges.json` |
| X-4 | Paint state after recovery | A focused run reached ready + painted; the full five-worker suite failed when ready remained unpainted. | major | no, mapped to RB-16 | `.harness/verify/e2e.log`, `evidence/c2-eval-2/browser-probes.json` |

## Findings

| heuristic | artifact | severity | problem | recommendation | rubric id |
| --- | --- | --- | --- | --- | --- |
| H-UX-2.3 | `.harness/verify/e2e.log` | major | Under full-suite concurrency the compile-error recovery journey reports the preview ready while its painted flag remains false; the focused journey passes, indicating an intermittent completion/paint race. | Keep the run visibly in progress until a non-empty painted preview is confirmed, and stabilize the recovery journey at configured concurrency. | RB-16 |

## Rubric refinement suggestions

| RS | type | item | problem | suggestion |
| --- | --- | --- | --- | --- |
| assigned by kernel | add-verification | RB-8 | UI does not prove absence of a fourth Engineer call or direct persistence of the final version row. | Add deterministic repair call-count and final run/version persistence evidence. |
| assigned by kernel | add-verification | RB-12 | UI badge persistence does not compare values stored on both run and version rows. | Verify identical qa_score values from run, version, workbench badge and reloaded home card. |
| assigned by kernel | refine | RB-16 | Current check does not account for intermittent unpainted preview under configured parallel execution. | Require stable repeated recovery at configured concurrency and non-empty painted content before completion. |
