# Evaluation — iterate-versions, cycle 1 (confirm)
Tools: Playwright 1.65.1; `harness capture` run `c1-2` (status **fail**, 1/3 pages — dynamic `/projects/[projectId]` and `/share/[shareSlug]` remain literal placeholders); supplemental browser journey `c1-2-browser` (real project + share screenshots, regenerated from scratch). App: `pnpm exec next start --port 3000` with `LLM_PROVIDER=mock`. HEAD: `8d8813e`. `fh verify` recorded passing ids `typecheck`, `lint`, `unit`, `build`, `e2e` at this HEAD.

## E2E cases
| case | category | blocking | result | evidence |
| --- | --- | --- | --- | --- |
| E2E-1 | core | yes | PASS | `journey-results.json` E2E-1 (`codeHasPriority`); verify e2e `iterate-versions.spec.ts` |
| E2E-2 | core | yes | PASS | `workbench-version-timeline.png`, `workbench-after-rollback-*.png`; journey E2E-2 |
| E2E-3 | negative | yes | PASS | `public-read-only-share.png`; visitor mutation 403; no restore/zip |
| E2E-4 | negative | yes | PASS | journey E2E-4 status 403 `无权修改此项目` |
| E2E-5 | boundary | no | PASS | journey E2E-5: continue 200, version rowCount stayed 2 |
| E2E-6 | crossFeature | no | PASS | new version rows carry `QA 100 分` after follow-up; agent cards remain |
| E2E-7 | persistence | yes | PASS | `workbench-persistence-reload.png`; both versions + restored preview after reload |
| E2E-8 | uiJourney | yes | PASS | journey E2E-8 preview/code restored to v1; both rows retained |

Blocking failures: none.

## Rubric (judge items)
| id | layer | level | score | reason | artifacts |
| --- | --- | --- | --- | --- | --- |
| RB-2 | L4 | important | 0.5 | Completed new version clear; no owner follow-up prompt in UI | timeline + initial workbench |
| RB-4 | L3 | important | 1 | Timeline scan matches REF-1 | timeline screenshots |
| RB-6 | L4 | important | 1 | Share is clearly read-only with preview/code | share screenshots |
| RB-8 | L4 | important | 1 | 下载 ZIP discoverable with 正在导出… feedback | zip screenshots |
| RB-10 | L3 | important | 1 | Seeded cards + examples on first paint | home captures |
| RB-12 | L4 | important | 1 | Rollback journey visibly restores preview/code | rollback + persistence |
| RB-14 | L2 | pitfall | 1 | Pitfall absent — history kept, preview/code aligned | rollback screenshots |
| RB-16 | L3 | pitfall | 1 | Pitfall absent — ≥2 scored seed cards | home captures |
| RB-18 | L3 | essential | 1 | 版本 tab complete and legible | timeline screenshots |
| RB-21 | L4 | pitfall | 1 | Pitfall absent — no public mutations | share screenshot + 403 |

## Comparison with references
| dimension | REF-n / RL | ours | gap | fix | rubric id |
| --- | --- | --- | --- | --- | --- |
| Workbench calm tabs + QA badge | REF-1 | Matches; 版本 sits with 预览/代码 | none | — | RB-4, RB-18 |
| Rollback as safe select | ANTI-1 / RL-1 | Non-destructive; both rows remain | none | — | RB-14, RB-12 |
| Public read-only | RL-2 | 只读分享; mutations denied | none | — | RB-6, RB-21 |
| Seeded first paint | RL-3 | 2 cards with scores + 4 prompts | minor clipped node on home | check truncate | RB-10, RB-16 |
| Follow-up action clarity | REF-1 interaction | Result visible; action only via API | add follow-up composer | RB-2 |

## Exploratory findings
| id | probe | result | severity | add as E2E case? | evidence |
| --- | --- | --- | --- | --- | --- |
| P1 | empty submit | 开始生成 stays disabled; remains on `/` | info | no | `home-empty-submit.png` |
| P2 | long input (606 chars + emoji/RTL) | accepted; submit enables; clipped=1 | minor | maybe | `home-long-input.png` |
| P3 | rapid double ZIP click | button text returns to 下载 ZIP; not left disabled | minor | yes | `probe-double-zip.png` |
| P4 | back/forward mid project | navigates between run query URLs without crash | info | no | journey probes.backForward |

## Findings
| heuristic | artifact | severity | problem | recommendation | rubric id |
| --- | --- | --- | --- | --- | --- |
| H-UX-6.1 | `workbench-initial.png` | major | Owner workbench has no visible follow-up prompt; REQ-1 iteration only via continue API | Add Chinese follow-up input + send on workbench | RB-2 |
| capture | `evidence/c1-2/manifest.json` | major | `harness capture` cannot resolve `/projects/[projectId]` or `/share/[shareSlug]` | Capture after minting real ids, or drop placeholder routes from automated capture | — |
| H-UI-6.4 | home screenshots | minor | Measured 1 clipped node on home at 1280px | Ensure project/example text wraps or truncates with tooltip | RB-10 |
| H-UX-2.4 | `probe-double-zip.png` | minor | ZIP control not observably locked for double submit | Keep disabled while export pending | RB-8 |

## Rubric refinement suggestions
| RS (assigned by kernel) | type | item | problem | suggestion |
| --- | --- | --- | --- | --- |
| (pending) | add | RB-2 | follow-up can pass via API without UI | L4 essential: workbench exposes Chinese follow-up input + send |
| (pending) | refine | RB-10 | overflow not required | zero clipped text in 我的项目 at 1280px |
| (pending) | add | RB-8 | no double-export pitfall | pitfall: export control stays pending/disabled in flight |
| (pending) | add-verification | pages.json | capture fails on bracket routes | require seeded/demo routes or capture hooks for workbench/share |
