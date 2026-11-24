# Evaluation — generate-loop, cycle 1 (evaluate)
Tools: Playwright 1.65.x; `fh verify` all green @ e76120c; official `harness capture` run c1-2 **fail** (1/3 pages — home only); authenticated browser evidence run `c1-2-browser` (journeys + probes)

## Capture note
`pages.json` routes workbench to `/projects/demo`. That path 404s (no seed project; workbench requires `deviceId` cookie ownership). `harness capture generate-loop --run-id c1-2` therefore failed on workbench pages even after creating a real project via API (fresh capture browser has no cookie). Judge artifacts for workbench/interaction items cite the authenticated Playwright evidence under `evidence/c1-2-browser/`.

## E2E cases
| case | category | blocking | result | evidence |
| --- | --- | --- | --- | --- |
| E2E-1 | core | yes | PASS* | results.json + workbench-preview*.png — timeline completes + srcdoc mock markers; *visual paint still blank (see RB-30) |
| E2E-2 | core | yes | PASS | workbench-after-generate.png, workbench-timeline-expanded.png |
| E2E-3 | negative | yes | PASS | workbench-interrupted.png (继续 + interrupted) |
| E2E-4 | negative | yes | PASS | home-empty-submit.png (submit disabled) |
| E2E-5 | boundary | no | PASS | home.png / home-example-filled.png (4 cards + fill) |
| E2E-6 | persistence | yes | PASS | home-after-projects.png (projects listed after refresh) |
| E2E-7 | uiJourney | no | PASS | workbench-code*.png, workbench-preview-return.png; sandbox=allow-scripts |
| E2E-8 | crossFeature | no | PASS | results.json cookieName=deviceId |

Also: project `fh verify` e2e id passed (12 tests) under `LLM_PROVIDER=mock`.

## Rubric (judge items)
| id | layer | level | score | reason | artifacts |
| --- | --- | --- | --- | --- | --- |
| RB-2 | L3 | essential | 1 | Home matches REF-1 Chinese chrome + cards + 我的项目 | c1-2/home.png, c1-2-browser/home.png |
| RB-3 | L3 | pitfall | 1 | ANTI-1 English-only chrome absent | home.png |
| RB-39 | L4 | essential | 0.5 | Expandable live timeline works; false interrupt banner + 运行中 on completed | workbench-after-generate.png, timeline-expanded |
| RB-9 | L3 | essential | 1 | Chinese Planner/Architect/Engineer + status/elapsed/payload | timeline-expanded |
| RB-10 | L4 | pitfall | 1 | Timeline Chinese progress present (RL-3 timeline half) | after-generate |
| RB-13 | L3 | important | 0.5 | 预览/代码 chrome + code tree OK; preview visually blank | preview*.png, code-selected |
| RB-22 | L4 | important | 0.5 | 继续 on interrupt OK; also incorrectly shown after success | interrupted.png, after-generate |
| RB-30 | L4 | important | 0 | Preview pane blank after mock generate (RL-3) | preview-late, iframe clips |
| RB-31 | L4 | important | 1 | Example card fills prompt | home-example-filled.png |
| RB-33 | L3 | pitfall | 1 | No external CDN requests in journey | results.json cdnHits=[] |

## Comparison with references
| dimension | REF-n / RL | ours | gap | fix | rubric id |
| --- | --- | --- | --- | --- | --- |
| Home chrome | REF-1 | centered prompt, 4 cards, 我的项目 | none material | — | RB-2 |
| Timeline | REF-1 / RL-3 | Chinese agents + expand | status copy inconsistency | hide interrupt chrome when completed; sync header status | RB-9, RB-39 |
| Preview | REF-1 / RL-3 | iframe+srcdoc present, paint blank | user-visible preview empty | fix esbuild-wasm paint / srcdoc bootstrap so UI renders | RB-13, RB-30 |
| CDN / sandbox | RL-2 / ANTI-1 | no CDN hits; sandbox allow-scripts | none observed | — | RB-33 |
| Interrupt | REF-1 | 继续 visible on abort | over-shown on success | gate banner on interrupted only | RB-22 |

## Exploratory findings
| id | probe | result | severity | add as E2E case? | evidence |
| --- | --- | --- | --- | --- | --- |
| P1 | empty submit | disabled, stayed on / | info | already E2E-4 | home-empty-submit.png |
| P2 | example fill | fills prompt | info | already E2E-5 | home-example-filled.png |
| P3 | long input 1200 chars | accepted | minor | optional boundary | home-long-input.png |
| P4 | rapid double submit | single workbench navigation | info | maybe | results probe-double via E2E-1 path |
| P5 | SSE abort | interrupted + 继续 | major (false positive on success path) | yes — assert absence after completed | interrupted.png |
| P6 | CDN watch | zero external CDN | info | keep | results.json |
| P7 | late preview paint 8s | still blank white iframe | critical | yes — visual non-blank | preview-late |

## Findings
| heuristic | artifact | severity | problem | recommendation | rubric id |
| --- | --- | --- | --- | --- | --- |
| H-UI-6.1 / H-PR-3.1 | workbench-preview-late.png, preview-iframe-clip-late.png | critical | After successful mock generate, 预览 remains visually blank despite large srcdoc with mock markers | Fix preview bootstrap/paint so iframe shows 我的待办 UI; add visual e2e assertion | RB-30 |
| H-UX-2.3 | workbench-after-generate.png | major | Completed run still shows 连接已中断…继续 and header 运行中 while timeline 已完成 | Drive banner/header strictly from run status | RB-39, RB-22 |
| H-UI-6.4 | results overflowWorkbench=3 | minor | Expanded JSON payload triggers horizontal overflow counters | Wrap/scroll payload pre | RB-9 |
| capture/pages | c1-2/manifest.json | major (eval tooling) | `/projects/demo` uncapturable (404 / no device cookie) | Seed fixture or capture after authenticated submit | RB-2 suggestion |

## Rubric refinement suggestions
| RS (assigned by kernel) | type | item | problem | suggestion |
| --- | --- | --- | --- | --- |
| (pending) | refine | RB-2 | pages.json demo route not capturable | seeded/authenticated workbench capture path |
| (pending) | add | — | false interrupt chrome on completed | L4 item: completed ⇒ no 继续 banner / no 运行中 |
| (pending) | refine | RB-10 | RL-3 split across items | clarify timeline-only vs preview RB-30 |
| (pending) | refine | RB-13 | tabs can pass while paint fails | require painted mock UI pixels |
| (pending) | refine | RB-22 | only checks presence | require absence on completed |
| (pending) | add-verification | RB-30 | srcdoc-only e2e | visual non-blank assertion |
