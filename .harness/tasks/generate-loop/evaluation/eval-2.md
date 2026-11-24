# Evaluation — generate-loop, cycle 2 (confirm-evaluation)

Tools: `@playwright/test` Chromium via `pnpm exec playwright test`; capture run `c2-confirm-20261123` (pass, 1/1 configured page). App ran from the built Next.js app with `LLM_PROVIDER=mock`. Evaluated HEAD: `0e436d5`. `fh verify` recorded passing ids `typecheck`, `lint`, `unit`, `e2e`, `build` at this HEAD. The additional browser case run passed 11/11 tests.

## E2E cases

| Case | Category | Blocking | Result | Evidence |
|---|---|---:|---|---|
| E2E-1 | core | yes | PASS | `e2e-cases-c2.md`; painted preview screenshot and accessible mock marker |
| E2E-2 | core | yes | PASS | `e2e-cases-c2.md`; Chinese timeline labels and expandable payloads |
| E2E-3 | negative | yes | PASS | `e2e-cases-c2.md`; interrupted screenshot shows status and 继续; completed success has no recovery chrome |
| E2E-4 | negative | yes | PASS | `e2e-cases-c2.md`; empty/whitespace submit stays disabled and route remains home |
| E2E-5 | boundary | no | PASS | `e2e-cases-c2.md`; first example fills prompt |
| E2E-6 | persistence | yes | PASS | `e2e-cases-c2.md`; Planner-derived project title remains after hard refresh |
| E2E-7 | uiJourney | no | PASS | `e2e-cases-c2.md`; Code tree/source and Preview round trip, sandbox is `allow-scripts` |
| E2E-8 | crossFeature | no | PASS | `e2e-cases-c2.md`; device cookie is minted and a second browser context cannot see the project |

No cases were skipped. Direct HTTP checks of project creation, empty prompt and malformed JSON are recorded in `api-c2.md`.

## Rubric (judge items)

| ID | Layer | Level | Score | Reason | Artifacts |
|---|---|---|---:|---|---|
| RB-2 | L3-ui | essential | 1 | Centered prompt, four examples, Chinese empty project state | `evidence/c2-confirm-20261123/home.png` |
| RB-3 | L3-ui | pitfall | 1 | English-only marketing chrome is absent | `evidence/c2-confirm-20261123/home.png` |
| RB-39 | L4-interaction | essential | 1 | All agent payloads expand; interrupt recovery appears only on interrupted state | `evidence/c2-confirm-20261123/workbench-all-expanded.png`, `workbench-interrupted.png` |
| RB-9 | L3-ui | essential | 1 | Chinese labels, status, elapsed time, and expandable payloads are visible | `evidence/c2-confirm-20261123/workbench-all-expanded.png` |
| RB-10 | L4-interaction | pitfall | 1 | Chinese Planner/Architect/Engineer progress is present | `evidence/c2-confirm-20261123/workbench-timeline.png` |
| RB-13 | L3-ui | important | 0.5 | Preview and Code work, but long source lines are clipped at the right pane edge | `evidence/c2-confirm-20261123/workbench-preview.png`, `workbench-code.png` |
| RB-22 | L4-interaction | important | 1 | Chinese 继续 appears on disconnect and is absent after success | `evidence/c2-confirm-20261123/workbench-interrupted.png`, `e2e-cases-c2.md` |
| RB-30 | L4-interaction | important | 1 | Preview renders identifiable mock app pixels and accessible probe text | `evidence/c2-confirm-20261123/workbench-preview.png`, `exploratory-results.json` |
| RB-31 | L4-interaction | important | 1 | Example click fills the prompt | `evidence/c2-confirm-20261123/example-filled.png` |
| RB-33 | L3-ui | pitfall | 1 | Browser observed no requests to external CDNs during the journey | `evidence/c2-confirm-20261123/exploratory-results.json` |

Scored subset by layer (pitfalls reported as pass when absent): L3-ui 0.83 across its three non-pitfall judges; L4-interaction 1.00 across its three non-pitfall judges. The remaining rubric layers were not represented in this evaluator packet. Verification ids are recorded in each judge evidence file.

## Comparison with references

| Dimension | Anchor | Ours | Gap | Recommendation | Rubric ID |
|---|---|---|---|---|---|
| Home hierarchy and density | REF-1 | Centered prompt, four examples, and project empty state in an airy single column | No material gap at 1280×800 | Keep the current hierarchy | RB-2 |
| Workbench timeline | REF-1 | Clear two-pane layout; Chinese agent cards show status, elapsed time, and payload controls | Expanded payload regions have bounded height and may require internal scrolling | Keep payload controls visible and ensure long payloads remain scrollable | RB-9 |
| Preview and code | REF-1 | Tabs switch; mock preview is painted; selected file source is present | Long source lines are clipped at the pane edge, with no visible horizontal-scroll cue | Make horizontal scrolling or wrapping discoverable at desktop and mobile widths | RB-13 |

## Exploratory findings

| Probe | Result | Severity | Evidence |
|---|---|---|---|
| Long multilingual input (1,054 characters, emoji, RTL text) | Input retained and submit remained enabled | info | `evidence/c2-confirm-20261123/exploratory-results.json` |
| Rapid repeated submit | The forced double-click produced one `POST /api/projects` request and one workbench route | info | `evidence/c2-confirm-20261123/exploratory-results.json` |
| Back/forward after generate | Back returned home and forward returned to workbench | info | `evidence/c2-confirm-20261123/exploratory-results.json` |
| CDN request observation | No matching CDN requests during generation and preview | info | `evidence/c2-confirm-20261123/exploratory-results.json` |

## Findings

| Heuristic | Artifact | Severity | Problem | Recommendation | Rubric ID |
|---|---|---|---|---|---|
| H-UI-6.4 | `evidence/c2-confirm-20261123/workbench-code.png` | minor | Long lines in the source viewer are clipped at the pane's right edge at 1280px; horizontal scrolling is not apparent in the screenshot | Expose horizontal scrolling or wrap source lines and verify at 1280px and 375px | RB-13 |
| H-PR-1.1 | `api-c2.md` | info | The API contract omits expected status and body for malformed input, so only rejection and observed Chinese response can be checked | Specify error response behavior and add outside-in assertions | RB-4 |

## Rubric refinement suggestions

| Type | Item | Problem | Suggestion |
|---|---|---|---|
| refine | RB-13 | The criterion does not state how clipped source lines remain accessible at the target viewport | Require source to remain readable through visible horizontal scrolling or wrapping at 1280px and 375px |
| add-verification | RB-4 | Existing judge coverage does not directly state the expected API response for valid, empty, and malformed project-create requests | Add HTTP contract checks for status, response fields, Chinese validation response, and device cookie scope |
