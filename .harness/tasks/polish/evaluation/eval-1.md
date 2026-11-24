# Evaluation — polish, cycle 1 (evaluate)
Tools: Playwright 1.65.1; `harness capture` run `c1-1` (status **fail**, 1/3 pages — dynamic `/projects/[projectId]` and `/share/[shareSlug]` routes are literal placeholders); supplemental browser journey `c1-1-browser` (real project + share screenshots + CDN audit). App: `pnpm exec next start --port 3000` with `LLM_PROVIDER=mock`. HEAD: `5ccf11a`. `fh verify` recorded passing ids `typecheck`, `lint`, `unit`, `build`, `e2e` at this HEAD.

## E2E cases
| case | category | blocking | result | evidence |
| --- | --- | --- | --- | --- |
| E2E-1 | core | yes | PASS | `journey-results.json` E2E-1 (`codeHasPriority`); verify e2e `polish.spec.ts` follow-up |
| E2E-2 | core | yes | PASS | CDN audit 0 offenders / 204+ requests; verify e2e `cdn-audit` |
| E2E-3 | negative | yes | PASS | `share-read-only-polish.png`; follow-up/ZIP/share controls absent |
| E2E-4 | negative | yes | PASS | mobileWidth=375; sandbox=`allow-scripts` |
| E2E-5 | boundary | no | PASS | reduced-motion pulse/transitions `0s` |
| E2E-6 | crossFeature | no | PASS | `演示回放` banner + `已达修复上限` at qa_rounds=3 |
| E2E-7 | persistence | yes | PASS | `workbench-persistence-reload.png`; follow-up remains after reload |
| E2E-8 | uiJourney | yes | PASS | keyboard reaches follow-up / code tab / width toggle; cards unclipped |

Blocking failures: none.

## Rubric (judge items)
| id | layer | level | score | reason | artifacts |
| --- | --- | --- | --- | --- | --- |
| RB-2 | L3 | essential | 1 | Calm Chinese zinc UI matches REF-1 across home/workbench/share | home + workbench + share |
| RB-3 | L3 | important | 1 | Zero visible card clip; code pane scroll/wrap reachable | 1280/375 + code pane |
| RB-4 | L4 | pitfall | 1 | Pitfall absent — reduced-motion kills decorative animation | reduced-motion shot |
| RB-6 | L4 | essential | 1 | Follow-up discoverable with clear disabled/pending + banners | follow-up + banners |
| RB-9 | L4 | important | 1 | Focus rings, landmarks/labels, AA-looking contrast light/dark | focus + dark shots |
| RB-10 | L4 | pitfall | 1 | Pitfall absent — rings + labelled iframe/tabs | focus + share |
| RB-13 | L3 | important | 1 | System fonts + long-cache preview assets; no font CDN CLS | home + cache header |
| RB-16 | L4 | important | 1 | 桌面/移动 toggle discoverable; frame responsive | desktop/mobile preview |
| RB-20 | L3 | important | 1 | Delivery write-up clear and complete | README + DELIVERY |
| RB-21 | L2 | pitfall | 1 | Pitfall absent — no secrets / brief paste | docs |
| RB-24 | L4 | important | 1 | Reachability story matches audit + docs | journey + DELIVERY |
| RB-25 | L1 | pitfall | 1 | Pitfall absent — zero forbidden CDN hosts | journey CDN |
| RB-27 | L3 | important | 1 | Chinese empty/loading/error/replay/cap states clear | banners + polish-states |
| RB-28 | L3 | essential | 1 | Desktop/mobile frames distinct; sandbox intact | preview shots |
| RB-30 | L3 | pitfall | 1 | Pitfall absent — system fonts only | home + journey fonts |

## Comparison with references
| dimension | REF-n / RL | ours | gap | fix | rubric id |
| --- | --- | --- | --- | --- | --- |
| Calm Chinese workbench | REF-1 | Matches zinc cards, tabs, QA badges, follow-up rail | none | — | RB-2, RB-6 |
| No clipped 我的项目 / reachable code | RL-1 | Cards unclipped; code scrolls + 自动换行 | none (sr-only false positive) | — | RB-3 |
| Reduced motion | RL-2 | Decorative motion fully suppressed | none | — | RB-4 |
| No external CDN | RL-3 | Audit clean on three routes | none | — | RB-24, RB-25 |
| Docs hygiene | RL-4 | No keys / brief text | none | — | RB-20, RB-21 |
| Anti marketing flash / font CDN | ANTI-1 | Absent | none | — | RB-30, RB-2 |

## Exploratory findings
| id | probe | result | severity | add as E2E case? | evidence |
| --- | --- | --- | --- | --- | --- |
| P1 | empty submit | 开始生成 stays disabled on `/` | info | no | `home-visual-system.png` |
| P2 | long input (606 chars + emoji/RTL) | accepted; submit enables; clipped=1 is sr-only label | info | no | `home-long-input.png` |
| P3 | rapid double follow-up click | send disabled after submit | info | no | `probe-double-follow-up.png` |
| P4 | seeded workbench first paint | rare planner「进行中 · 0s」while header 已完成 + preview still「正在打包预览…」 | minor | maybe | `workbench-polish-states.png` |

## Findings
| heuristic | artifact | severity | problem | recommendation | rubric id |
| --- | --- | --- | --- | --- | --- |
| capture | `evidence/c1-1/manifest.json` | major | `harness capture` cannot resolve `/projects/[projectId]` or `/share/[shareSlug]` | Capture after minting real ids, or drop placeholder routes from automated capture | — |
| H-PR-2.1 | `workbench-polish-states.png` | minor | Seeded workbench can briefly show planner running while overall status is completed | Ensure seed reopen hydrates timeline status consistently before paint | RB-27 |
| H-UI-6.4 | journey measurements | info | Generic clipped-node probe counts `sr-only` labels | Exclude `sr-only` / visually hidden from clip metrics | RB-3 |

## Rubric refinement suggestions
| RS (assigned by kernel) | type | item | problem | suggestion |
| --- | --- | --- | --- | --- |
| (pending) | refine | RB-9 | lab()/oklch colors defeat RGB contrast evaluate helpers | require token-based or forced-RGB contrast probe for light+dark body/heading samples |
| (pending) | add-verification | pages.json | capture fails on bracket routes | require seeded/demo routes or capture hooks for workbench/share |
| (pending) | refine | RB-3 | clipped heuristic false-positives on sr-only | exclude aria-hidden/sr-only nodes from H-UI-6.4 measurement |
